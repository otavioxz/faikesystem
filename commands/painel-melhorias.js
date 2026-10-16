const {
  SlashCommandBuilder,
  MessageFlags,
  InteractionContextType,
  ChannelType,
  PermissionFlagsBits,
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

    const channelId = interaction.options.getChannel("canal")?.id ?? interaction.channelId;
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

    // Confere as permissões do bot antes de enviar (evita o erro 50001 Missing Access)
    const necessarias = {
      ViewChannel: "Ver canal",
      SendMessages: "Enviar mensagens",
    };
    const perms = channel?.permissionsFor(interaction.guild.members.me);
    const faltando = Object.entries(necessarias)
      .filter(([flag]) => !perms?.has(PermissionFlagsBits[flag]))
      .map(([, nome]) => `\`${nome}\``);

    if (!channel || faltando.length) {
      return interaction.reply({
        content: `Não consigo enviar o painel em <#${channelId}>. Permissões que faltam para o bot nesse canal: ${faltando.join(", ") || "`Ver canal`"}.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

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
