const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('version')
        .setDescription('Checks the currently running bot version.'),
    async execute(interaction) {
        const version = process.env.BOT_VERSION || 'Not Set';
        await interaction.reply({ content: `I am currently running version: **${version}**`, ephemeral: true });
    }
};