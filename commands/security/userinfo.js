const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    isSecurityCommand: true,
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('[Security] Displays a security profile for a user.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to get info on')
                .setRequired(true)),
    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
        const { violationHistory } = interaction.client.security;

        if (!targetMember) {
            return interaction.reply({ content: 'User is not a member of this server.', ephemeral: true });
        }

        const userHistory = violationHistory.get(targetUser.id) || [];
        const accountAge = Date.now() - targetUser.createdTimestamp;
        const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));

        let riskLevel = 'Low';
        if (accountAgeDays < 7) riskLevel = 'Medium';
        if (userHistory.length > 3) riskLevel = 'High';
        if (accountAgeDays < 2 && userHistory.length > 0) riskLevel = 'Critical';

        const embed = new EmbedBuilder()
            .setColor(riskLevel === 'Low' ? '#00FF00' : (riskLevel === 'Medium' ? '#FFA500' : '#FF0000'))
            .setTitle(`Security Profile: ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL())
            .addFields(
                { name: 'User', value: `${targetUser.tag} (${targetUser.id})`, inline: false },
                { name: 'Account Age', value: `${accountAgeDays} days`, inline: true },
                { name: 'Total Violations', value: `${userHistory.length}`, inline: true },
                { name: 'Risk Assessment', value: `**${riskLevel}**`, inline: true },
                { name: 'Joined Server', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`, inline: true },
            )
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};