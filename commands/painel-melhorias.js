const {
  SlashCommandBuilder,
  MessageFlags,
  InteractionContextType,
  ChannelType,
} = require("discord.js");
const { ADMIN_ID, buildPainel } = require("../utils/melhorias");

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
    ),
  async execute(interaction) {
    if (interaction.user.id !== ADMIN_ID) {
      return interaction.reply({
        content: "Este comando só pode ser usado pelo desenvolvedor do bot.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const channel = interaction.options.getChannel("canal") || interaction.channel;

    await channel.send({
      flags: MessageFlags.IsComponentsV2,
      components: [buildPainel(interaction.guild)],
    });

    await interaction.reply({
      content: `Painel enviado em ${channel}. Use \`/config-melhorias\` para definir os cargos permitidos e o canal de fallback.`,
      flags: [MessageFlags.Ephemeral],
    });
  },
};
