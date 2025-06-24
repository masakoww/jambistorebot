const { SlashCommandBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
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
        .setName('edititem')
        .setDescription('[Admin] Edits an existing product in the shop.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option => option.setName('product').setDescription('The product to edit.').setRequired(true).setAutocomplete(true))
        .addNumberOption(option => option.setName('new_price').setDescription('The new price for the item.'))
        .addIntegerOption(option => option.setName('new_stock').setDescription('The new stock count for the item.')),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const productId = interaction.options.getString('product');
        const newPrice = interaction.options.getNumber('new_price');
        const newStock = interaction.options.getInteger('new_stock');

        if (newPrice === null && newStock === null) {
            return interaction.editReply({ content: 'You must provide at least a new price or a new stock count.' });
        }

        const productsPath = path.join(__dirname, '../../products.json');
        let products = interaction.client.products;
        const productIndex = products.findIndex(p => p.id === productId);

        if (productIndex === -1) {
            return interaction.editReply({ content: 'Error: Could not find that product.' });
        }
        
        const product = products[productIndex];
        if (newPrice !== null) product.price = newPrice;
        if (newStock !== null) product.stock = newStock;
        
        fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));

        try {
            const channel = await interaction.client.channels.fetch(product.channelId);
            const message = await channel.messages.fetch(product.messageId);
            const oldEmbed = message.embeds[0];

            const newEmbed = EmbedBuilder.from(oldEmbed)
                .setFields(
                    { name: 'Harga', value: `Rp ${product.price.toLocaleString('id-ID')}`, inline: true },
                    { name: 'Stok', value: `${product.stock}`, inline: true }
                );
            
            await message.edit({ embeds: [newEmbed] });
            await interaction.editReply({ content: `✅ Successfully updated the product "${product.name}".` });
        } catch (error) {
            console.error("Failed to update product message:", error);
            await interaction.editReply({ content: '✅ Product data updated, but I failed to edit the original message (it might have been deleted).' });
        }
    },
};