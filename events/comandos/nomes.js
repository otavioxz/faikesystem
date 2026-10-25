const { Events, MessageFlags } = require("discord.js");
const { TIPOS, SEPARADORES, buildNomes } = require("../../utils/nomes");
const owner = process.env.OWNER;

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.customId?.startsWith("nomes_")) return;

    if (interaction.user.id !== owner) {
      return interaction.reply({
        content: "Este comando só pode ser usado pelo dono do bot.",
        flags: [MessageFlags.Ephemeral],
      });
    }

    const [action, ...args] = interaction.customId.split(":");
    let tipo, quantidade, sep;

    switch (action) {
      case "nomes_gerar":
        [tipo, quantidade, sep] = args;
        break;
      case "nomes_tipo":
        tipo = interaction.values[0];
        [quantidade, sep] = args;
        break;
      case "nomes_sep":
        [tipo, quantidade] = args;
        sep = interaction.values[0];
        break;
      default:
        return;
    }
    if (!TIPOS[tipo] || !SEPARADORES[sep]) return;

    return interaction.update({
      components: [buildNomes(tipo, Number(quantidade) || 15, sep)],
    });
  },
};
