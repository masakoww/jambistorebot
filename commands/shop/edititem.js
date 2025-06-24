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

        // ... (validation) ...

        const productsPath = path.join(__dirname, '../../products.json');
        let products = interaction.client.products;
        const productIndex = products.findIndex(p => p.id === productId);

        if (productIndex === -1) { /* ... */ }
        
        const product = products[productIndex];
        if (newPrice !== null) product.price = newPrice;
        if (newStock !== null) product.stock = newStock;
        
        fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));

        try {
            const channel = await interaction.client.channels.fetch(product.channelId);
            const message = await channel.messages.fetch(product.messageId);
            
            // Calculate rating string
            let averageRating = 0;
            const ratings = product.ratings || [];
            if (ratings.length > 0) {
                averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
            }
            const ratingString = '⭐'.repeat(Math.round(averageRating)) + '✩'.repeat(5 - Math.round(averageRating));

            const newEmbed = new EmbedBuilder()
                .setColor(message.embeds[0].color)
                .setTitle(product.name)
                .setDescription(product.description)
                .setImage(product.imageUrl)
                .setFields(
                    { name: 'Harga', value: `Rp ${product.price.toLocaleString('id-ID')}`, inline: true },
                    { name: 'Stok', value: `${product.stock}`, inline: true },
                    { name: 'Terjual', value: `${product.totalSold || 0}`, inline: true },
                    { name: 'Rating', value: `${ratingString} (${ratings.length} reviews)`, inline: false }
                );
            
            await message.edit({ embeds: [newEmbed] });
            await interaction.editReply({ content: `✅ Successfully updated the product "${product.name}".` });
        } catch (error) {
            console.error("Failed to update product message:", error);
            await interaction.editReply({ content: '✅ Product data updated, but I failed to edit the original shop message.' });
        }
    },
};