const {
  SlashCommandBuilder,
  MessageFlags,
  InteractionContextType,
  ChannelType,
} = require("discord.js");
const {
  ADMIN_ID,
  readDb,
  writeDb,
  buildPainel,
} = require("../utils/melhorias");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("painel-melhorias")
    .setDescription("Envia o painel de solicitações de melhoria do bot.")
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((opt) =>
      opt
        .setName("canal")
        .setDescription("Canal onde o painel será enviado (padrão: este canal)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addRoleOption((opt) =>
      opt
        .setName("cargo")
        .setDescription("Cargo responsável que também poderá enviar solicitações")
    ),
  async execute(interaction) {
    if (interaction.user.id !== ADMIN_ID) {
      return interaction.reply({
        content: "Este comando só pode ser usado pelo desenvolvedor do bot.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const channel = interaction.options.getChannel("canal") || interaction.channel;
    const role = interaction.options.getRole("cargo");

    if (role) {
      const db = readDb();
      const guildCfg = (db.guilds[interaction.guildId] ??= { roles: [] });
      if (!guildCfg.roles.includes(role.id)) guildCfg.roles.push(role.id);
      writeDb(db);
    }

    await channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [buildPainel(interaction.guild)],
    });

    await interaction.reply({
      content:
        `Painel enviado em ${channel}.` +
        (role ? ` O cargo ${role} agora pode enviar solicitações.` : ""),
      flags: [MessageFlags.Ephemeral],
      allowedMentions: { parse: [] },
    });
  },
};
