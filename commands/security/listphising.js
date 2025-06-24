const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    isSecurityCommand: true,
    data: new SlashCommandBuilder()
        .setName('listphishing')
        .setDescription('[Security] Lists all currently blocked phishing domains.'),
    async execute(interaction) {
        const { config } = interaction.client.security;
        const domains = config.phishingDomains;

        const embed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('🚫 Phishing Domain List')
            .setDescription(domains.length > 0 ? domains.map(d => `• \`${d}\``).join('\n') : 'The list is currently empty.')
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};