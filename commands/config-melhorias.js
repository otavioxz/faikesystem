const {
  SlashCommandBuilder,
  MessageFlags,
  InteractionContextType,
} = require("discord.js");
const { ADMIN_ID, buildConfig } = require("../utils/melhorias");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("config-melhorias")
    .setDescription("Configura a Central de Solicitações neste servidor.")
    .setContexts(InteractionContextType.Guild),
  async execute(interaction) {
    if (interaction.user.id !== ADMIN_ID) {
      return interaction.reply({
        content: "Este comando só pode ser usado pelo desenvolvedor do bot.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    await interaction.reply({
      flags: [MessageFlags.Ephemeral, MessageFlags.IsComponentsV2],
      components: [buildConfig(interaction.guild)],
      allowedMentions: { parse: [] },
    });
  },
};
