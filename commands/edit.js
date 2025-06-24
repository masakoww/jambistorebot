const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder } = require('discord.js');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('edit')
        .setDescription('Edits an existing announcement message sent by the bot.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .setDMPermission(false)
        .addStringOption(option =>
            option.setName('message_id')
                .setDescription('The ID of the message you want to edit')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel where the message is located')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true))
        .addStringOption(option => option.setName('new_title').setDescription('The new title for the embed.'))
        .addStringOption(option => option.setName('new_description').setDescription('The new description. Use \\n for new lines.'))
        .addStringOption(option => option.setName('new_price').setDescription('The new price for the item.'))
        .addStringOption(option => option.setName('new_image_url').setDescription('The new image URL for the embed.')),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const messageId = interaction.options.getString('message_id');
        const channel = interaction.options.getChannel('channel');
        const newTitle = interaction.options.getString('new_title');
        const newDescription = interaction.options.getString('new_description');
        const newPrice = interaction.options.getString('new_price');
        const newImageUrl = interaction.options.getString('new_image_url');

        try {
            const messageToEdit = await channel.messages.fetch(messageId);

            if (messageToEdit.author.id !== interaction.client.user.id) {
                return interaction.editReply({ content: 'Error: I can only edit messages that I have sent.', ephemeral: true });
            }

            const originalEmbed = messageToEdit.embeds[0];
            if (!originalEmbed) {
                return interaction.editReply({ content: 'Error: The target message does not contain an embed.', ephemeral: true });
            }

            // Create a new embed from the old one to preserve existing data
            const editedEmbed = EmbedBuilder.from(originalEmbed);

            // Update fields only if a new value was provided
            if (newTitle) {
                editedEmbed.setTitle(newTitle);
            }
            if (newDescription) {
                editedEmbed.setDescription(newDescription.replace(/\\n/g, '\n'));
            }
            if (newImageUrl) {
                 if (!newImageUrl.startsWith('http://') && !newImageUrl.startsWith('https://')) {
                    return interaction.editReply({ content: 'Error: The new image URL must be a valid link.', ephemeral: true });
                }
                editedEmbed.setImage(newImageUrl);
            }
            if (newPrice) {
                // Find and update the 'Price/Harga' field.
                // This is more robust than assuming its position.
                const priceFieldIndex = editedEmbed.data.fields.findIndex(field => field.name === 'Price/Harga');
                if (priceFieldIndex > -1) {
                    editedEmbed.spliceFields(priceFieldIndex, 1, { name: 'Price/Harga', value: newPrice, inline: true });
                } else {
                    // If for some reason the field doesn't exist, add it.
                    editedEmbed.addFields({ name: 'Price/Harga', value: newPrice, inline: true });
                }
            }

            await messageToEdit.edit({ embeds: [editedEmbed] });
            await interaction.editReply({ content: 'Message successfully edited!', ephemeral: true });

        } catch (error) {
            console.error('Failed to edit message:', error);
            await interaction.editReply({ content: 'Error: Could not find or edit the message.', ephemeral: true });
        }
    },
};