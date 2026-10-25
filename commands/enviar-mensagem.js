const {
  SlashCommandBuilder,
  MessageFlags,
  InteractionContextType,
  ChannelType,
  PermissionFlagsBits,
  ModalBuilder,
  LabelBuilder,
  TextInputBuilder,
  TextInputStyle,
  FileUploadBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");
const owner = process.env.OWNER;

const MAX_IMAGENS = 4;

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

module.exports = {
  data: new SlashCommandBuilder()
    .setName("enviar-mensagem")
    .setDescription("Envia uma mensagem pelo bot com texto, imagens e separadores. (Apenas Dono)")
    .setContexts(InteractionContextType.Guild)
    .addChannelOption((opt) =>
      opt
        .setName("canal")
        .setDescription("Canal onde a mensagem será enviada (padrão: este canal)")
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    )
    .addBooleanOption((opt) =>
      opt
        .setName("separadores")
        .setDescription("Separar título, texto, imagens e rodapé com linhas (padrão: sim)")
    )
    .addBooleanOption((opt) =>
      opt
        .setName("mencoes")
        .setDescription("Permitir que @cargos, @usuários e @everyone notifiquem (padrão: não)")
    ),
  async execute(interaction) {
    if (interaction.user.id !== owner) {
      return interaction.reply({
        content: "Este comando só pode ser usado pelo dono do bot.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const channelId = interaction.options.getChannel("canal")?.id ?? interaction.channelId;
    const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

    // Confere as permissões do bot antes de abrir o forms (evita o erro 50001 Missing Access)
    const necessarias = {
      ViewChannel: "Ver canal",
      SendMessages: "Enviar mensagens",
      AttachFiles: "Anexar arquivos",
    };
    const perms = channel?.permissionsFor(interaction.guild.members.me);
    const faltando = Object.entries(necessarias)
      .filter(([flag]) => !perms?.has(PermissionFlagsBits[flag]))
      .map(([, nome]) => `\`${nome}\``);

    if (!channel || faltando.length) {
      return interaction.reply({
        content: `Não consigo enviar mensagens em <#${channelId}>. Permissões que faltam para o bot nesse canal: ${faltando.join(", ") || "`Ver canal`"}.`,
        flags: [MessageFlags.Ephemeral],
      });
    }

    const separadores = interaction.options.getBoolean("separadores") ?? true;
    const mencoes = interaction.options.getBoolean("mencoes") ?? false;

    const modal = new ModalBuilder()
      .setCustomId(`enviarmsg_modal:${channel.id}:${+separadores}:${+mencoes}`)
      .setTitle("Enviar mensagem")
      .addLabelComponents(
        input("titulo", "Título", TextInputStyle.Short, {
          max: 100,
          required: false,
          placeholder: "Aparece em destaque no topo",
          description: "Opcional",
        }),
        input("conteudo", "Mensagem", TextInputStyle.Paragraph, {
          max: 3500,
          placeholder: "Aceita markdown. Uma linha só com --- vira um separador.",
        }),
        input("rodape", "Rodapé", TextInputStyle.Short, {
          max: 200,
          required: false,
          placeholder: "Texto pequeno no final da mensagem",
          description: "Opcional",
        }),
        new LabelBuilder()
          .setLabel("Imagens")
          .setDescription(`Opcional · até ${MAX_IMAGENS} imagens, GIFs ou vídeos`)
          .setFileUploadComponent(
            new FileUploadBuilder()
              .setCustomId("imagens")
              .setMinValues(0)
              .setMaxValues(MAX_IMAGENS)
              .setRequired(false)
          ),
        new LabelBuilder()
          .setLabel("Posição das imagens")
          .setStringSelectMenuComponent(
            new StringSelectMenuBuilder()
              .setCustomId("posicao")
              .setRequired(false)
              .addOptions(
                { label: "Abaixo do texto", value: "abaixo", default: true },
                { label: "Acima do texto", value: "acima", description: "Logo abaixo do título, como banner" }
              )
          )
      );

    await interaction.showModal(modal);
  },
};
