const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    isSecurityCommand: true,
    data: new SlashCommandBuilder()
        .setName('violationhistory')
        .setDescription('[Security] Shows the detailed violation history for a user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check')
                .setRequired(true)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const { violationHistory } = interaction.client.security;
        const userHistory = violationHistory.get(targetUser.id) || [];

        if (userHistory.length === 0) {
            return interaction.reply({ content: 'This user has no violation history.', ephemeral: true });
        }

        const recentHistory = userHistory.slice(-10).reverse(); // Show last 10, newest first

        const description = recentHistory.map(v => {
            const timestamp = `<t:${Math.floor(new Date(v.timestamp).getTime() / 1000)}:f>`;
            return `**Type:** ${v.type.toUpperCase()}\n**When:** ${timestamp}\n**Reason:** ${v.details.reason}`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor('#FFC0CB')
            .setTitle(`Violation History for ${targetUser.username}`)
            .setDescription(description)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};