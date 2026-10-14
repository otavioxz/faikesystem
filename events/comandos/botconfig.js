const {
  Events,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  ActivityType,
  PresenceUpdateStatus,
  MessageFlags,
} = require("discord.js");
const token = process.env.TOKEN;
const owner = process.env.OWNER;
const fs = require("node:fs");
const path = require("node:path");
const axios = require("axios");
const ms = require("ms");

const dbConfigPath = path.join(__dirname, "../../database/config.json");
const promptFilePath = path.join(__dirname, "../../database/prompt.json");
const channelsFilePath = path.join(__dirname, "../../database/channels.json");
const historyFilePath = path.join(__dirname, "../../database/historico.json");
const autoClearFilePath = path.join(
  __dirname,
  "../../database/auto-clear.json"
);

if (!fs.existsSync(autoClearFilePath)) {
  fs.writeFileSync(
    autoClearFilePath,
    JSON.stringify({ active: false, channels: [] }, null, 2)
  );
}

const createMainMenu = () => {
  const promptButton = new ButtonBuilder()
    .setCustomId("config_prompt_btn")
    .setLabel("Configurar Prompt")
    .setEmoji("<:configbot:1305593471285067776>")
    .setStyle(ButtonStyle.Secondary);
  const channelsButton = new ButtonBuilder()
    .setCustomId("config_channels_panel_btn")
    .setLabel("Configurar Canais")
    .setEmoji("<:configbot:1305593471285067776>")
    .setStyle(ButtonStyle.Secondary);
  const customizeButton = new ButtonBuilder()
    .setCustomId("customize_bot_panel_btn")
    .setLabel("Personalizar Bot")
    .setEmoji("<:robo:1305672475459326054>")
    .setStyle(ButtonStyle.Secondary);
  const autoClearButton = new ButtonBuilder()
    .setCustomId("auto_clear_panel_btn")
    .setLabel("Limpeza Automática")
    .setEmoji("<:Relogio:1305593456311140443>")
    .setStyle(ButtonStyle.Secondary);
  const resetButton = new ButtonBuilder()
    .setCustomId("reset_history_btn")
    .setLabel("Resetar Histórico")
    .setEmoji("1309962546718969908")
    .setStyle(ButtonStyle.Danger);
  const row1 = new ActionRowBuilder().addComponents(
    promptButton,
    channelsButton,
    customizeButton
  );
  const row2 = new ActionRowBuilder().addComponents(
    autoClearButton,
    resetButton
  );
  return [row1, row2];
};

const createAutoClearPanel = () => {
  const data = JSON.parse(fs.readFileSync(autoClearFilePath, "utf-8"));
  const statusButton = new ButtonBuilder()
    .setCustomId("auto_clear_status_btn")
    .setLabel(data.active ? "Sistema Ativado" : "Sistema Desativado")
    .setEmoji(
      data.active
        ? "<:accept:1305153239821324319>"
        : "<:xx1:1306694256559128637>"
    )
    .setStyle(ButtonStyle.Secondary);
  const addButton = new ButtonBuilder()
    .setCustomId("auto_clear_add_channel_btn")
    .setLabel("Adicionar Canal")
    .setEmoji("<:adicionar:1305243177803972781>")
    .setStyle(ButtonStyle.Success);
  const removeButton = new ButtonBuilder()
    .setCustomId("auto_clear_remove_channel_btn")
    .setLabel("Remover Canal")
    .setEmoji("<:menos:1305243152952725646>")
    .setStyle(ButtonStyle.Danger);
  const viewButton = new ButtonBuilder()
    .setCustomId("view_auto_clear_channels_btn_0")
    .setLabel("Ver Canais")
    .setEmoji("<:cisearchmagnifyingglass:1397071717351952416>")
    .setStyle(ButtonStyle.Secondary);
  const backButton = new ButtonBuilder()
    .setCustomId("back_to_main_config_btn")
    .setLabel("Voltar")
    .setEmoji("<:emoji_45:1305590970062082078>")
    .setStyle(ButtonStyle.Secondary);
  const row1 = new ActionRowBuilder().addComponents(
    statusButton,
    addButton,
    removeButton,
    viewButton
  );
  const row2 = new ActionRowBuilder().addComponents(backButton);
  return [row1, row2];
};

const createCustomizePanel = () => {
  const nameButton = new ButtonBuilder()
    .setCustomId("edit_bot_name_btn")
    .setLabel("Editar Nome")
    .setEmoji("<:lapis:1305591472887959663>")
    .setStyle(ButtonStyle.Secondary);
  const avatarButton = new ButtonBuilder()
    .setCustomId("edit_bot_avatar_btn")
    .setLabel("Editar Avatar")
    .setEmoji("<:lapis:1305591472887959663>")
    .setStyle(ButtonStyle.Secondary);
  const bioButton = new ButtonBuilder()
    .setCustomId("edit_bot_bio_btn")
    .setLabel("Editar Bio")
    .setEmoji("<:lapis:1305591472887959663>")
    .setStyle(ButtonStyle.Secondary);
  const statusButton = new ButtonBuilder()
    .setCustomId("edit_bot_status_btn")
    .setLabel("Trocar Status")
    .setEmoji("<:1245149003012902985:1305152392828031027>")
    .setStyle(ButtonStyle.Secondary);
  const backButton = new ButtonBuilder()
    .setCustomId("back_to_main_config_btn")
    .setLabel("Voltar")
    .setEmoji("<:emoji_45:1305590970062082078>")
    .setStyle(ButtonStyle.Secondary);
  const row1 = new ActionRowBuilder().addComponents(
    nameButton,
    avatarButton,
    bioButton,
    statusButton
  );
  const row2 = new ActionRowBuilder().addComponents(backButton);
  return [row1, row2];
};

const createChannelsPanel = () => {
  const addButton = new ButtonBuilder()
    .setCustomId("add_channel_btn")
    .setLabel("Adicionar")
    .setEmoji("<:adicionar:1305243177803972781>")
    .setStyle(ButtonStyle.Success);
  const removeButton = new ButtonBuilder()
    .setCustomId("remove_channel_btn")
    .setLabel("Remover")
    .setEmoji("<:menos:1305243152952725646>")
    .setStyle(ButtonStyle.Danger);
  const viewButton = new ButtonBuilder()
    .setCustomId("view_channels_btn_0")
    .setLabel("Ver Canais")
    .setEmoji("<:cisearchmagnifyingglass:1397071717351952416>")
    .setStyle(ButtonStyle.Secondary);
  const backButton = new ButtonBuilder()
    .setCustomId("back_to_main_config_btn")
    .setLabel("Voltar")
    .setEmoji("<:emoji_45:1305590970062082078>")
    .setStyle(ButtonStyle.Secondary);
  return new ActionRowBuilder().addComponents(
    addButton,
    removeButton,
    viewButton,
    backButton
  );
};

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.error(
          `[ERRO] Nenhum comando correspondente a ${interaction.commandName} foi encontrado.`
            .red.bold
        );
        return;
      }
      try {
        await command.execute(interaction);
      } catch (error) {
        console.error("[ERRO]".red.bold, error);
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: "Ocorreu um erro ao executar este comando!",
            flags: [MessageFlags.Ephemeral],
          });
        } else {
          await interaction.reply({
            content: "Ocorreu um erro ao executar este comando!",
            flags: [MessageFlags.Ephemeral],
          });
        }
      }
      return;
    }

    // Interações do painel de melhorias são tratadas em melhorias.js
    if (interaction.customId?.startsWith("melhoria_")) return;

    if (interaction.isButton()) {
      if (interaction.user.id !== owner) {
        return interaction.reply({
          content: "Você não tem permissão para usar este painel.",
          flags: [MessageFlags.Ephemeral],
        });
      }

      const { customId } = interaction;

      if (customId === "back_to_main_config_btn") {
        await interaction.update({
          content: "Escolha uma opção de configuração:",
          embeds: [],
          components: createMainMenu(),
        });
      } else if (customId === "back_to_customize_panel_btn") {
        await interaction.update({
          content: "Personalize a aparência do seu bot:",
          embeds: [],
          components: createCustomizePanel(),
        });
      } else if (customId === "auto_clear_panel_btn") {
        await interaction.update({
          content:
            "Gerencie o sistema de limpeza automática de mensagens.\nO sistema verifica os canais a cada minuto.",
          embeds: [],
          components: createAutoClearPanel(),
        });
      } else if (customId === "auto_clear_status_btn") {
        const data = JSON.parse(fs.readFileSync(autoClearFilePath, "utf-8"));
        data.active = !data.active;
        fs.writeFileSync(autoClearFilePath, JSON.stringify(data, null, 2));
        await interaction.update({
          content: `Sistema de limpeza automática ${
            data.active ? "ativado" : "desativado"
          }.`,
          embeds: [],
          components: createAutoClearPanel(),
        });
      } else if (customId === "auto_clear_add_channel_btn") {
        const modal = new ModalBuilder()
          .setCustomId("add_auto_clear_channel_modal")
          .setTitle("Adicionar Canal à Limpeza");
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("channel_id_input")
              .setLabel("ID do Canal de Texto")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("Ex: 123456789012345678")
              .setRequired(true)
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("channel_cooldown_input")
              .setLabel("Intervalo de Limpeza")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder('Ex: "30m", "1h", "6h", "1d"')
              .setRequired(true)
          )
        );
        await interaction.showModal(modal);
      } else if (customId === "auto_clear_remove_channel_btn") {
        const modal = new ModalBuilder()
          .setCustomId("remove_auto_clear_channel_modal")
          .setTitle("Remover Canal da Limpeza");
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("channel_id_input")
              .setLabel("ID do Canal de Texto a ser removido")
              .setStyle(TextInputStyle.Short)
              .setRequired(true)
          )
        );
        await interaction.showModal(modal);
      } else if (customId.startsWith("view_auto_clear_channels_btn")) {
        const page = parseInt(customId.split("_")[5]) || 0;
        const data = JSON.parse(fs.readFileSync(autoClearFilePath, "utf-8"));
        const channels = data.channels || [];

        if (channels.length === 0) {
          return interaction.update({
            content: "Não há canais configurados para a limpeza automática.",
            embeds: [],
            components: createAutoClearPanel(),
          });
        }

        const CHANNELS_PER_PAGE = 5;
        const totalPages = Math.ceil(channels.length / CHANNELS_PER_PAGE);
        const pageChannels = channels.slice(
          page * CHANNELS_PER_PAGE,
          page * CHANNELS_PER_PAGE + CHANNELS_PER_PAGE
        );

        const embed = new EmbedBuilder()
          .setTitle("Canais com Limpeza Automática")
          .setDescription(
            pageChannels
              .map(
                (ch, index) =>
                  `${page * CHANNELS_PER_PAGE + index + 1}. <#${ch.id}> (\`${
                    ch.id
                  }\`)\n   └ Intervalo: \`${ch.cooldown}\``
              )
              .join("\n\n")
          )
          .setColor("#2f3036")
          .setFooter({ text: `Página ${page + 1} de ${totalPages}` });

        const prevButton = new ButtonBuilder()
          .setCustomId(`view_auto_clear_channels_btn_${page - 1}`)
          .setLabel("Anterior")
          .setEmoji('<:icoutlinearrowback:1397063579483508837>')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0);
        const nextButton = new ButtonBuilder()
          .setCustomId(`view_auto_clear_channels_btn_${page + 1}`)
          .setLabel("Próximo")
          .setEmoji('<:icsharparrowforward1:1397063432494387251>')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page + 1 >= totalPages);
        const backButton = new ButtonBuilder()
          .setCustomId("auto_clear_panel_btn")
          .setLabel("Voltar ao Painel")
          .setEmoji('<:emoji_45:1305590970062082078>')
          .setStyle(ButtonStyle.Primary);

        await interaction.update({
          content: "",
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(
              prevButton,
              nextButton,
              backButton
            ),
          ],
        });
      } else if (customId === "reset_history_btn") {
        const confirmButton = new ButtonBuilder()
          .setCustomId("confirm_reset_history_btn")
          .setLabel("Sim, apagar tudo")
          .setEmoji("<:accept:1305153239821324319>")
          .setStyle(ButtonStyle.Danger);
        const cancelButton = new ButtonBuilder()
          .setCustomId("back_to_main_config_btn")
          .setLabel("Não, cancelar")
          .setEmoji("<:xx1:1306694256559128637>")
          .setStyle(ButtonStyle.Secondary);
        await interaction.update({
          content:
            "**Você tem certeza?**\nEsta ação apagará **TODO** o histórico de conversas de **TODOS** os usuários. Esta ação é irreversível.",
          embeds: [],
          components: [
            new ActionRowBuilder().addComponents(confirmButton, cancelButton),
          ],
        });
      } else if (customId === "confirm_reset_history_btn") {
        fs.writeFileSync(historyFilePath, JSON.stringify({}, null, 2));
        await interaction.update({
          content: "Resetado com Sucesso!\nEscolha uma opção de configuração:",
          embeds: [],
          components: createMainMenu(),
        });
      } else if (customId === "customize_bot_panel_btn") {
        await interaction.update({
          content: "Personalize a aparência do seu bot:",
          embeds: [],
          components: createCustomizePanel(),
        });
      } else if (customId === "edit_bot_status_btn") {
        const selectMenu = new StringSelectMenuBuilder()
          .setCustomId("activity_type_select")
          .setPlaceholder("Selecione um tipo de atividade")
          .addOptions(
            { label: "Jogando", value: "Playing" },
            { label: "Transmitindo", value: "Streaming" },
            { label: "Ouvindo", value: "Listening" },
            { label: "Assistindo", value: "Watching" },
            { label: "Competindo", value: "Competing" }
          );
        const backButton = new ButtonBuilder()
          .setCustomId("back_to_customize_panel_btn")
          .setLabel("Voltar")
          .setEmoji("<:emoji_45:1305590970062082078>")
          .setStyle(ButtonStyle.Secondary);
        await interaction.update({
          content: "Primeiro, escolha o tipo de atividade ou volte:",
          components: [
            new ActionRowBuilder().addComponents(selectMenu),
            new ActionRowBuilder().addComponents(backButton),
          ],
        });
      } else if (
        customId === "edit_bot_name_btn" ||
        customId === "edit_bot_avatar_btn" ||
        customId === "edit_bot_bio_btn"
      ) {
        let modal;
        if (customId === "edit_bot_name_btn") {
          modal = new ModalBuilder()
            .setCustomId("edit_name_modal")
            .setTitle("Editar Nome do Bot");
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("bot_name_input")
                .setLabel("Novo nome do bot")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );
        } else if (customId === "edit_bot_avatar_btn") {
          modal = new ModalBuilder()
            .setCustomId("edit_avatar_modal")
            .setTitle("Editar Avatar do Bot");
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("bot_avatar_input")
                .setLabel("URL da imagem para o novo avatar")
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
            )
          );
        } else {
          modal = new ModalBuilder()
            .setCustomId("edit_bio_modal")
            .setTitle("Editar Bio do Bot");
          modal.addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("bot_bio_input")
                .setLabel("Nova bio (Sobre Mim)")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
            )
          );
        }
        await interaction.showModal(modal);
      } else if (customId === "config_prompt_btn") {
        const currentPrompt =
          JSON.parse(fs.readFileSync(promptFilePath, "utf-8")).prompt || "";
        const modal = new ModalBuilder()
          .setCustomId("prompt_modal")
          .setTitle("Configuração de Prompt");
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("prompt_input")
              .setLabel("Digite o novo prompt do bot")
              .setStyle(TextInputStyle.Paragraph)
              .setValue(currentPrompt)
              .setRequired(true)
          )
        );
        await interaction.showModal(modal);
      } else if (customId === "config_channels_panel_btn") {
        await interaction.update({
          content: "Gerencie os canais onde o bot pode interagir:",
          embeds: [],
          components: [createChannelsPanel()],
        });
      } else if (
        customId === "add_channel_btn" ||
        customId === "remove_channel_btn"
      ) {
        const isAdding = customId === "add_channel_btn";
        const modal = new ModalBuilder()
          .setCustomId(isAdding ? "add_channel_modal" : "remove_channel_modal")
          .setTitle(isAdding ? "Adicionar Canal" : "Remover Canal");
        modal.addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId("channel_id_input")
              .setLabel("ID do Canal de Texto")
              .setStyle(TextInputStyle.Short)
              .setPlaceholder("Ex: 123456789012345678")
              .setRequired(true)
          )
        );
        await interaction.showModal(modal);
      } else if (customId.startsWith("view_channels_btn")) {
        const page = parseInt(customId.split("_")[3]) || 0;
        const channelData = JSON.parse(
          fs.readFileSync(channelsFilePath, "utf-8")
        );
        const canais = channelData.canais || [];

        if (canais.length === 0)
          return interaction.update({
            content: "Não há canais configurados.",
            embeds: [],
            components: [createChannelsPanel()],
          });

        const CHANNELS_PER_PAGE = 5;
        const totalPages = Math.ceil(canais.length / CHANNELS_PER_PAGE);
        const pageChannels = canais.slice(
          page * CHANNELS_PER_PAGE,
          page * CHANNELS_PER_PAGE + CHANNELS_PER_PAGE
        );
        const embed = new EmbedBuilder()
          .setTitle("Canais Configurados")
          .setDescription(
            pageChannels
              .map(
                (id, index) =>
                  `${
                    page * CHANNELS_PER_PAGE + index + 1
                  }. <#${id}> (\`${id}\`)`
              )
              .join("\n")
          )
          .setColor("#2f3036")
          .setFooter({ text: `Página ${page + 1} de ${totalPages}` });
        const prevButton = new ButtonBuilder()
          .setCustomId(`view_channels_btn_${page - 1}`)
          .setLabel("Anterior")
          .setEmoji("<:icoutlinearrowback:1397063579483508837>")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0);
        const nextButton = new ButtonBuilder()
          .setCustomId(`view_channels_btn_${page + 1}`)
          .setLabel("Próximo")
          .setEmoji("<:icsharparrowforward1:1397063432494387251>")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page + 1 >= totalPages);
        const backButton = new ButtonBuilder()
          .setCustomId("config_channels_panel_btn")
          .setLabel("Voltar ao Painel")
          .setEmoji("<:emoji_45:1305590970062082078>")
          .setStyle(ButtonStyle.Primary);
        await interaction.update({
          content: "",
          embeds: [embed],
          components: [
            new ActionRowBuilder().addComponents(
              prevButton,
              nextButton,
              backButton
            ),
          ],
        });
      }
      return;
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.user.id !== owner) return;
      const { customId, values } = interaction;
      if (customId === "activity_type_select") {
        const activityType = values[0];
        const modal = new ModalBuilder()
          .setCustomId(`edit_status_text_modal_${activityType}`)
          .setTitle("Definir Status do Bot");
        const statusTextInput = new TextInputBuilder()
          .setCustomId("bot_status_text_input")
          .setLabel("O que o bot está fazendo?")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);
        const onlineStatusInput = new TextInputBuilder()
          .setCustomId("bot_online_status_input")
          .setLabel("Status (online, idle, dnd)")
          .setStyle(TextInputStyle.Short)
          .setRequired(false)
          .setPlaceholder("Padrão: online");
        modal.addComponents(
          new ActionRowBuilder().addComponents(statusTextInput)
        );
        if (activityType === "Streaming") {
          const streamUrlInput = new TextInputBuilder()
            .setCustomId("bot_stream_url_input")
            .setLabel("URL da live (Twitch ou YouTube)")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder("Ex: https://twitch.tv/seu_canal")
            .setRequired(true);
          modal.addComponents(
            new ActionRowBuilder().addComponents(streamUrlInput)
          );
        }
        modal.addComponents(
          new ActionRowBuilder().addComponents(onlineStatusInput)
        );
        await interaction.showModal(modal);
      }
      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.user.id !== owner) return;
      const { customId } = interaction;

      if (customId === "add_auto_clear_channel_modal") {
        const channelId =
          interaction.fields.getTextInputValue("channel_id_input");
        const cooldown = interaction.fields.getTextInputValue(
          "channel_cooldown_input"
        );

        if (isNaN(ms(cooldown))) {
          return interaction.reply({
            content: `Erro: O formato do cooldown "${cooldown}" é inválido. Use formatos como "10m", "2h", "1.5d".`,
            flags: [MessageFlags.Ephemeral],
          });
        }

        const data = JSON.parse(fs.readFileSync(autoClearFilePath, "utf-8"));
        if (!data.channels) data.channels = [];
        if (data.channels.some((c) => c.id === channelId)) {
          return interaction.reply({
            content: `Erro: O canal com ID \`${channelId}\` já está configurado.`,
            flags: [MessageFlags.Ephemeral],
          });
        }

        data.channels.push({
          id: channelId,
          cooldown: cooldown,
          lastCleaned: 0,
        });
        fs.writeFileSync(autoClearFilePath, JSON.stringify(data, null, 2));

        return interaction.reply({
          content: `Canal <#${channelId}> adicionado com sucesso para limpeza a cada \`${cooldown}\`.`,
          flags: [MessageFlags.Ephemeral],
        });
      }

      if (customId === "remove_auto_clear_channel_modal") {
        const channelId =
          interaction.fields.getTextInputValue("channel_id_input");
        const data = JSON.parse(fs.readFileSync(autoClearFilePath, "utf-8"));

        if (!data.channels || data.channels.length === 0) {
          return interaction.reply({
            content: `Erro: Não há canais configurados para remover.`,
            flags: [MessageFlags.Ephemeral],
          });
        }

        const channelExists = data.channels.some((c) => c.id === channelId);
        if (!channelExists) {
          return interaction.reply({
            content: `Erro: O canal com ID \`${channelId}\` não foi encontrado na lista.`,
            flags: [MessageFlags.Ephemeral],
          });
        }

        data.channels = data.channels.filter((c) => c.id !== channelId);
        fs.writeFileSync(autoClearFilePath, JSON.stringify(data, null, 2));

        return interaction.reply({
          content: `Canal <#${channelId}> removido da limpeza automática.`,
          flags: [MessageFlags.Ephemeral],
        });
      }

      if (customId.startsWith("edit_status_text_modal")) {
        const activityTypeStr = customId.split("_")[4];
        const activityName = interaction.fields.getTextInputValue(
          "bot_status_text_input"
        );
        let onlineStatusStr =
          interaction.fields
            .getTextInputValue("bot_online_status_input")
            .toLowerCase() || "online";
        if (!["online", "idle", "dnd"].includes(onlineStatusStr))
          onlineStatusStr = "online";

        let streamUrl;
        if (activityTypeStr === "Streaming") {
          streamUrl = interaction.fields.getTextInputValue(
            "bot_stream_url_input"
          );
          if (!/^https?:\/\/(www\.)?(twitch\.tv|youtube\.com)\/.+/i.test(streamUrl)) {
            return interaction.reply({
              content:
                "Erro: A URL informada precisa ser um link válido do Twitch ou YouTube (ex: https://twitch.tv/seu_canal).",
              flags: [MessageFlags.Ephemeral],
            });
          }
        }

        const dbConfig = JSON.parse(fs.readFileSync(dbConfigPath, "utf-8"));
        dbConfig.status = {
          activityType: activityTypeStr,
          activityName,
          onlineStatus: onlineStatusStr,
          ...(streamUrl && { streamUrl }),
        };
        fs.writeFileSync(dbConfigPath, JSON.stringify(dbConfig, null, 2));
        let activityType;
        switch (activityTypeStr) {
          case "Streaming":
            activityType = ActivityType.Streaming;
            break;
          case "Listening":
            activityType = ActivityType.Listening;
            break;
          case "Watching":
            activityType = ActivityType.Watching;
            break;
          case "Competing":
            activityType = ActivityType.Competing;
            break;
          default:
            activityType = ActivityType.Playing;
            break;
        }
        let onlineStatus;
        switch (onlineStatusStr) {
          case "idle":
            onlineStatus = PresenceUpdateStatus.Idle;
            break;
          case "dnd":
            onlineStatus = PresenceUpdateStatus.DoNotDisturb;
            break;
          default:
            onlineStatus = PresenceUpdateStatus.Online;
            break;
        }
        const activity = { name: activityName, type: activityType };
        if (activityType === ActivityType.Streaming) {
          activity.url = streamUrl;
        }
        client.user.setPresence({
          activities: [activity],
          status: onlineStatus,
        });
        await interaction.reply({
          content: "Status do bot atualizado com sucesso!",
          flags: [MessageFlags.Ephemeral],
        });
      }

      try {
        if (customId === "edit_name_modal") {
          await client.user.setUsername(
            interaction.fields.getTextInputValue("bot_name_input")
          );
          await interaction.reply({
            content: "Nome do bot atualizado com sucesso!",
            flags: [MessageFlags.Ephemeral],
          });
        } else if (customId === "edit_avatar_modal") {
          await client.user.setAvatar(
            interaction.fields.getTextInputValue("bot_avatar_input")
          );
          await interaction.reply({
            content: "Avatar do bot atualizado com sucesso!",
            flags: [MessageFlags.Ephemeral],
          });
        } else if (customId === "edit_bio_modal") {
          await axios.patch(
            "https://discord.com/api/v10/applications/@me",
            {
              description:
                interaction.fields.getTextInputValue("bot_bio_input"),
            },
            {
              headers: {
                Authorization: `Bot ${token}`,
                "Content-Type": "application/json",
              },
            }
          );
          await interaction.reply({
            content: "Bio do bot atualizada com sucesso!",
            flags: [MessageFlags.Ephemeral],
          });
        }
      } catch (error) {
        console.error("[ERRO DE PERSONALIZAÇÃO]".red.bold, error);
        await interaction.reply({
          content:
            "Falha ao atualizar o perfil. Verifique os logs e tente novamente mais tarde.",
          flags: [MessageFlags.Ephemeral],
        });
      }

      if (customId === "prompt_modal") {
        fs.writeFileSync(
          promptFilePath,
          JSON.stringify(
            { prompt: interaction.fields.getTextInputValue("prompt_input") },
            null,
            2
          )
        );
        await interaction.reply({
          content: "Prompt atualizado com sucesso!",
          flags: [MessageFlags.Ephemeral],
        });
      } else if (
        customId === "add_channel_modal" ||
        customId === "remove_channel_modal"
      ) {
        const isAdding = customId === "add_channel_modal";
        const channelId =
          interaction.fields.getTextInputValue("channel_id_input");
        const channelData = JSON.parse(
          fs.readFileSync(channelsFilePath, "utf-8")
        );
        if (!channelData.canais) channelData.canais = [];

        if (isAdding) {
          if (channelData.canais.includes(channelId))
            return interaction.reply({
              content: `Erro: O canal com ID \`${channelId}\` já está na lista.`,
              flags: [MessageFlags.Ephemeral],
            });
          channelData.canais.push(channelId);
        } else {
          if (!channelData.canais.includes(channelId))
            return interaction.reply({
              content: `Erro: O canal com ID \`${channelId}\` não foi encontrado na lista.`,
              flags: [MessageFlags.Ephemeral],
            });
          channelData.canais = channelData.canais.filter(
            (id) => id !== channelId
          );
        }
        fs.writeFileSync(
          channelsFilePath,
          JSON.stringify(channelData, null, 2)
        );
        await interaction.reply({
          content: `Canal com ID \`${channelId}\` ${
            isAdding ? "adicionado" : "removido"
          } com sucesso!`,
          flags: [MessageFlags.Ephemeral],
        });
      }
      return;
    }
  },
};
