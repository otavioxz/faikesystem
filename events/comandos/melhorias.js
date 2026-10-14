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
  podeSolicitar,
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

    // Ações da equipe no servidor hub
    if (action === "melhoria_status") {
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
      req.status = status;
      req.updatedBy = interaction.user.id;
      req.updatedAt = Date.now();
      writeDb(db);

      await interaction.update({
        components: [buildHub(req)],
        allowedMentions: { parse: [] },
      });

      const user = await client.users.fetch(req.userId).catch(() => null);
      if (user) {
        user
          .send({
            flags: MessageFlags.IsComponentsV2,
            components: [buildNotificacao(req)],
          })
          .catch(() => {});
      }
      return;
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
