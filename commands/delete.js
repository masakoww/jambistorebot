const { SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('delete')
        .setDescription('Deletes a message sent by the bot.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('The ID of the message you want to delete')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel where the message is located')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const messageId = interaction.options.getString('message_id');
        const channel = interaction.options.getChannel('channel');

        try {
            // Fetch the message from the specified channel
            const messageToDelete = await channel.messages.fetch(messageId);

            // Check if the bot actually sent this message
            if (messageToDelete.author.id !== interaction.client.user.id) {
                await interaction.editReply({ content: 'Error: I can only delete messages that I have sent myself.', ephemeral: true });
                return;
            }

            // Delete the message
            await messageToDelete.delete();

            await interaction.editReply({ content: 'Message successfully deleted!', ephemeral: true });

        } catch (error) {
            console.error('Failed to delete message:', error);
            await interaction.editReply({ content: 'Error: Could not find or delete the message. Please check the Message ID and Channel, and my permissions.', ephemeral: true });
        }
    },
};