const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    isSecurityCommand: true,
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('[Security] Checks the warning count for a specific user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to check')
                .setRequired(true)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const { warnings, config } = interaction.client.security;
        const userWarnings = warnings.get(targetUser.id) || {};

        const description = Object.entries(userWarnings).length > 0
            ? Object.entries(userWarnings).map(([type, count]) => `**${type.toUpperCase()}:** ${count} / ${config.warningLimit}`).join('\n')
            : 'This user has no active warnings.';

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle(`Warnings for ${targetUser.username}`)
            .setDescription(description)
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};