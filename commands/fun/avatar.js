const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription("Displays a user's avatar.")
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user whose avatar you want to see.')
                .setRequired(false)),
    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;

        const avatarEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle(`${user.username}'s Avatar`)
            .setImage(user.displayAvatarURL({ dynamic: true, size: 4096 }))
            .setTimestamp();

        await interaction.reply({ embeds: [avatarEmbed] });
    },
};