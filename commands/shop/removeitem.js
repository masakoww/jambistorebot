const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
    isAdmin: true,
    async autocomplete(interaction) {
        const products = interaction.client.products;
        const focusedValue = interaction.options.getFocused();
        const choices = products.map(p => ({ name: p.name, value: p.id }));
        const filtered = choices.filter(choice => choice.name.toLowerCase().startsWith(focusedValue.toLowerCase()));
        await interaction.respond(filtered.slice(0, 25));
    },
    data: new SlashCommandBuilder()
        .setName('removeitem')
        .setDescription('[Admin] Removes a product from the database and deletes its message.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option => option.setName('product').setDescription('The product to remove.').setRequired(true).setAutocomplete(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const productIdToRemove = interaction.options.getString('product');
        const productsPath = path.join(__dirname, '../../products.json');

        let products = interaction.client.products;
        const productToRemove = products.find(p => p.id === productIdToRemove);
        
        if (!productToRemove) {
            return interaction.editReply({ content: 'Error: Product not found.' });
        }

        const updatedProducts = products.filter(p => p.id !== productIdToRemove);
        interaction.client.products = updatedProducts;
        fs.writeFileSync(productsPath, JSON.stringify(updatedProducts, null, 2));

        try {
            const channel = await interaction.client.channels.fetch(productToRemove.channelId);
            const message = await channel.messages.fetch(productToRemove.messageId);
            await message.delete();
            await interaction.editReply({ content: '✅ Successfully removed the product and its shop message.' });
        } catch (error) {
            console.error("Failed to delete product message:", error);
            await interaction.editReply({ content: '✅ Product removed from the database, but I failed to delete the original message (it may have been deleted already).' });
        }
    },
};