const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('kirim')
        .setDescription('[Admin] Sends the product file to the customer in the ticket.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageChannels)
        .addStringOption(option => option.setName('product_name').setDescription('The name of the product being sent.').setRequired(true))
        .addAttachmentOption(option => option.setName('file').setDescription('The product file to send.').setRequired(true)),
    async execute(interaction) {
        if (!interaction.channel.name.startsWith('ticket-')) {
            return interaction.reply({ content: 'This command can only be used in a ticket channel.', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });

        const productName = interaction.options.getString('product_name');
        const file = interaction.options.getAttachment('file');

        const { ticketOwners } = interaction.client;
        const ownerId = ticketOwners.get(interaction.channel.id);

        if (!ownerId) {
            return interaction.editReply({ content: 'Could not find the original owner of this ticket.' });
        }
        
        const owner = await interaction.client.users.fetch(ownerId).catch(() => null);
        if (!owner) {
            return interaction.editReply({ content: 'Could not fetch the user to send the DM.' });
        }

        try {
            await owner.send({
                content: `Thank you for your purchase! Here is your product: **${productName}**`,
                files: [file]
            });

            const tocMessage = `✅ **Product has been sent successfully to ${owner.tag} via DM.**\n\n**Terms & Conditions:**\n- All sales are final.\n- Do not share this file.\n- Thank you for your business!`;
            await interaction.channel.send(tocMessage);

            await interaction.editReply({ content: 'Product delivered successfully.' });
        } catch (error) {
            console.error("DM delivery failed:", error);
            await interaction.editReply({ content: 'Failed to send DM to the user. They may have DMs disabled or have blocked the bot.' });
        }
    },
};