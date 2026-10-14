const {
  Events,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
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

function input(id, label, style, { min, max, required = true, placeholder }) {
  const builder = new TextInputBuilder()
    .setCustomId(id)
    .setLabel(label)
    .setStyle(style)
    .setRequired(required)
    .setMaxLength(max);
  if (min) builder.setMinLength(min);
  if (placeholder) builder.setPlaceholder(placeholder);
  return new ActionRowBuilder().addComponents(builder);
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
          .addComponents(
            input("mensagem", "Mensagem para o usuário (opcional)", TextInputStyle.Paragraph, {
              max: 1000,
              required: false,
              placeholder: "Será enviada na DM junto com a atualização de status",
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
          .addComponents(
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
              placeholder: "Comando usado, exemplo, prints, links...",
            })
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

        const db = readDb();
        const id = ++db.counter;
        const req = {
          id,
          categoria: cat,
          prioridade: prio,
          titulo: interaction.fields.getTextInputValue("titulo").trim(),
          descricao: interaction.fields.getTextInputValue("descricao").trim(),
          detalhes: interaction.fields.getTextInputValue("detalhes").trim(),
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
          allowedMentions: { parse: [] },
        });
        req.hubMessageId = msg.id;
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
