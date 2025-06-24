const { SlashCommandBuilder, ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('ann')
        .setDescription('[Admin] Sends a general server announcement as plain text.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to send the announcement to')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement) // Allow regular and announcement channels
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The announcement message. Use \\n for new lines.')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('ping_everyone')
                .setDescription('Whether to include an @everyone ping. (Default: False)')),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const channel = interaction.options.getChannel('channel');
        const message = interaction.options.getString('message').replace(/\\n/g, '\n');
        const shouldPing = interaction.options.getBoolean('ping_everyone') ?? false;

        let finalContent = message;
        if (shouldPing) {
            finalContent = `@everyone\n\n${message}`;
        }

        try {
            await channel.send({
                content: finalContent,
                // Explicitly state which mentions are allowed to ensure the ping works.
                allowedMentions: { parse: ['everyone'] }
            });
            await interaction.editReply({ content: `Announcement successfully sent to ${channel}.` });
        } catch (error) {
            console.error('Failed to send announcement:', error);
            await interaction.editReply({ 
                content: 'Error: Could not send the announcement. Please check my permissions in that channel (I need "Send Messages" and "Mention @everyone").' 
            });
        }
    },
};