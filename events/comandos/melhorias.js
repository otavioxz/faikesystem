const {
  Events,
  MessageFlags,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  FileUploadBuilder,
  AttachmentBuilder,
} = require("discord.js");
const hubChannelId = process.env.HUB_CHANNEL_ID;
const {
  ADMIN_ID,
  CATEGORIAS,
  PRIORIDADES,
  STATUS,
  COOLDOWN_MS,
  cooldowns,
  readDb,
  writeDb,
  formatId,
  getGuildConfig,
  podeSolicitar,
  buildConfig,
  buildEtapaCategoria,
  buildEtapaPrioridade,
  buildEtapaFormulario,
  buildConfirmacao,
  buildHub,
  buildNotificacao,
} = require("../../utils/melhorias");

const V2_EPHEMERAL = [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2];

// Limite de upload de bot sem boost: o que passar disso vai como link
const LIMITE_UPLOAD = 10 * 1024 * 1024;
const MAX_ANEXOS = 5;

function input(id, label, style, { min, max, required = true, placeholder, description }) {
  const builder = new TextInputBuilder()
    .setCustomId(id)
    .setStyle(style)
    .setRequired(required)
    .setMaxLength(max);
  if (min) builder.setMinLength(min);
  if (placeholder) builder.setPlaceholder(placeholder);
  const labelBuilder = new LabelBuilder()
    .setLabel(label)
    .setTextInputComponent(builder);
  if (description) labelBuilder.setDescription(description);
  return labelBuilder;
}

// Baixa os anexos do forms (URLs temporárias) para reenviar no hub
async function baixarAnexos(uploads) {
  const files = [];
  const anexos = [];
  const links = [];
  let total = 0;

  for (const [i, att] of [...uploads.values()].entries()) {
    const nome = `${i + 1}-${att.name.replace(/[^\w.-]/g, "_")}`;
    const midia = /^(image|video)\//.test(att.contentType || "");

    if (total + att.size > LIMITE_UPLOAD) {
      links.push({ nome: att.name, url: att.url });
      continue;
    }
    try {
      const res = await fetch(att.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      files.push(
        new AttachmentBuilder(Buffer.from(await res.arrayBuffer()), {
          name: nome,
        })
      );
      anexos.push({ nome, original: att.name, midia });
      total += att.size;
    } catch {
      links.push({ nome: att.name, url: att.url });
    }
  }
  return { files, anexos, links };
}

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (!interaction.customId?.startsWith("melhoria_")) return;
    const [action, ...args] = interaction.customId.split(":");

    // Ações da equipe no servidor hub: botão abre o forms, o envio aplica o status
    if (action === "melhoria_status" || action === "melhoria_statusmodal") {
      if (interaction.user.id !== ADMIN_ID) {
        return interaction.reply({
          content: "Apenas o desenvolvedor do bot pode alterar o status.",
          flags: [MessageFlags.Ephemeral],
        });
      }
      const [id, status] = args;
      const db = readDb();
      const req = db.requests[id];
      if (!req || !STATUS[status]) {
        return interaction.reply({
          content: "Solicitação não encontrada.",
          flags: [MessageFlags.Ephemeral],
        });
      }

      if (action === "melhoria_status") {
        const modal = new ModalBuilder()
          .setCustomId(`melhoria_statusmodal:${id}:${status}`)
          .setTitle(`${formatId(req.id)} → ${STATUS[status].label}`)
          .addLabelComponents(
            input("mensagem", "Mensagem para o usuário", TextInputStyle.Paragraph, {
              max: 1000,
              required: false,
              placeholder: "Será enviada na DM junto com a atualização de status",
              description: "Opcional",
            })
          );
        return interaction.showModal(modal);
      }

      req.status = status;
      req.resposta = interaction.fields.getTextInputValue("mensagem").trim();
      req.updatedBy = interaction.user.id;
      req.updatedAt = Date.now();
      writeDb(db);

      await interaction.update({
        components: [buildHub(req)],
        allowedMentions: { parse: [] },
      });

      const user = await client.users.fetch(req.userId).catch(() => null);
      const enviada = await user
        ?.send({
          flags: MessageFlags.IsComponentsV2,
          components: [buildNotificacao(req)],
        })
        .catch(() => null);
      if (enviada) return;

      // DM fechada: tenta o canal de fallback do servidor de origem
      const fallbackId = db.guilds[req.guildId]?.fallbackChannelId;
      const fallback = fallbackId
        ? await client.channels.fetch(fallbackId).catch(() => null)
        : null;
      const noFallback = await fallback
        ?.send({
          flags: MessageFlags.IsComponentsV2,
          components: [buildNotificacao(req, { mencionar: true })],
          allowedMentions: { users: [req.userId] },
        })
        .catch(() => null);

      await interaction.followUp({
        content: noFallback
          ? `DM de <@${req.userId}> fechada. Atualização enviada no canal de fallback ${fallback}.`
          : `Status atualizado, mas não consegui avisar <@${req.userId}>: DM fechada e ${fallbackId ? "sem acesso ao canal de fallback" : "nenhum canal de fallback configurado"} em **${req.guildName}**.`,
        flags: [MessageFlags.Ephemeral],
        allowedMentions: { parse: [] },
      });
      return;
    }

    // Painel de configuração por servidor
    if (action === "melhoria_cfg_fallback" || action === "melhoria_cfg_roles") {
      if (interaction.user.id !== ADMIN_ID) {
        return interaction.reply({
          content: "Apenas o desenvolvedor do bot pode alterar a configuração.",
          flags: [MessageFlags.Ephemeral],
        });
      }
      const db = readDb();
      const cfg = getGuildConfig(db, interaction.guildId);
      if (action === "melhoria_cfg_fallback") {
        cfg.fallbackChannelId = interaction.values[0] ?? null;
      } else {
        cfg.roles = interaction.values;
      }
      writeDb(db);
      return interaction.update({
        components: [buildConfig(interaction.guild)],
        allowedMentions: { parse: [] },
      });
    }

    if (!interaction.inGuild()) return;

    if (!podeSolicitar(interaction.member, interaction.guildId)) {
      return interaction.reply({
        content:
          "Apenas administradores e cargos responsáveis podem enviar solicitações.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    switch (action) {
      case "melhoria_abrir": {
        const restante = (cooldowns.get(interaction.user.id) || 0) - Date.now();
        if (restante > 0) {
          return interaction.reply({
            content: `Aguarde <t:${Math.floor((Date.now() + restante) / 1000)}:R> para enviar outra solicitação.`,
            flags: [MessageFlags.Ephemeral],
          });
        }
        return interaction.reply({
          flags: V2_EPHEMERAL,
          components: [buildEtapaCategoria()],
        });
      }

      case "melhoria_reiniciar":
        return interaction.update({ components: [buildEtapaCategoria()] });

      case "melhoria_cat": {
        const cat = interaction.values[0];
        if (!CATEGORIAS[cat]) return;
        return interaction.update({ components: [buildEtapaPrioridade(cat)] });
      }

      case "melhoria_prio": {
        const [cat] = args;
        const prio = interaction.values[0];
        if (!CATEGORIAS[cat] || !PRIORIDADES[prio]) return;
        return interaction.update({
          components: [buildEtapaFormulario(cat, prio)],
        });
      }

      case "melhoria_form": {
        const [cat, prio] = args;
        const modal = new ModalBuilder()
          .setCustomId(`melhoria_modal:${cat}:${prio}`)
          .setTitle(`Solicitação — ${CATEGORIAS[cat].label}`)
          .addLabelComponents(
            input("titulo", "Título", TextInputStyle.Short, {
              min: 5,
              max: 80,
              placeholder: "Resuma em poucas palavras",
            }),
            input("descricao", "Descrição", TextInputStyle.Paragraph, {
              min: 20,
              max: 1500,
              placeholder: "Explique em detalhes",
            }),
            input("detalhes", "Informações adicionais", TextInputStyle.Paragraph, {
              max: 800,
              required: false,
              placeholder: "Comando usado, exemplo, links...",
              description: "Opcional",
            }),
            new LabelBuilder()
              .setLabel("Anexos")
              .setDescription(`Opcional · até ${MAX_ANEXOS} prints, vídeos ou arquivos`)
              .setFileUploadComponent(
                new FileUploadBuilder()
                  .setCustomId("anexos")
                  .setMinValues(0)
                  .setMaxValues(MAX_ANEXOS)
                  .setRequired(false)
              )
          );
        return interaction.showModal(modal);
      }

      case "melhoria_modal": {
        const [cat, prio] = args;
        if (!CATEGORIAS[cat] || !PRIORIDADES[prio]) return;

        if (!hubChannelId) {
          return interaction.reply({
            content: "O canal do hub não está configurado. Avise o dono do bot.",
            flags: [MessageFlags.Ephemeral],
          });
        }
        const hub = await client.channels.fetch(hubChannelId).catch(() => null);
        if (!hub?.isTextBased()) {
          return interaction.reply({
            content: "Não consegui acessar o canal do hub. Avise o dono do bot.",
            flags: [MessageFlags.Ephemeral],
          });
        }

        await interaction.deferUpdate();

        // Reserva o protocolo antes do download para não repetir ID
        let db = readDb();
        const id = ++db.counter;
        writeDb(db);

        const uploads = interaction.fields.getUploadedFiles("anexos");
        const { files, anexos, links } = uploads?.size
          ? await baixarAnexos(uploads)
          : { files: [], anexos: [], links: [] };

        const req = {
          id,
          categoria: cat,
          prioridade: prio,
          titulo: interaction.fields.getTextInputValue("titulo").trim(),
          descricao: interaction.fields.getTextInputValue("descricao").trim(),
          detalhes: interaction.fields.getTextInputValue("detalhes").trim(),
          anexos,
          anexosLinks: links,
          status: "pendente",
          guildId: interaction.guildId,
          guildName: interaction.guild.name,
          guildIcon: interaction.guild.iconURL({ size: 256 }),
          userId: interaction.user.id,
          userTag: interaction.user.tag,
          userAvatar: interaction.user.displayAvatarURL({ size: 256 }),
          createdAt: Date.now(),
        };

        const msg = await hub.send({
          flags: MessageFlags.IsComponentsV2,
          components: [buildHub(req)],
          files,
          allowedMentions: { parse: [] },
        });
        req.hubMessageId = msg.id;
        db = readDb();
        db.requests[id] = req;
        writeDb(db);

        cooldowns.set(interaction.user.id, Date.now() + COOLDOWN_MS);

        console.log(
          `[MELHORIAS] ${formatId(id)} enviada por ${req.userTag} em ${req.guildName}`
            .cyan.bold
        );

        return interaction.editReply({ components: [buildConfirmacao(req)] });
      }
    }
  },
};
