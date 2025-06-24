const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

module.exports = {
    isAdmin: true,
    data: new SlashCommandBuilder()
        .setName('postitem')
        .setDescription('[Admin] Posts a new product to a shop channel.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option => option.setName('name').setDescription('The unique name of the product.').setRequired(true))
        .addNumberOption(option => option.setName('price').setDescription('The price of the product (e.g., 15000).').setRequired(true))
        .addIntegerOption(option => option.setName('stock').setDescription('The available stock for this item.').setRequired(true))
        .addStringOption(option => option.setName('description').setDescription('A short description for the product.').setRequired(true))
        .addStringOption(option => option.setName('image_url').setDescription('A valid URL for the product image.').setRequired(true))
        .addChannelOption(option => option.setName('channel').setDescription('The shop channel to post this item in.').setRequired(true).addChannelTypes(ChannelType.GuildText)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const productsPath = path.join(__dirname, '../../products.json');
        let products = fs.existsSync(productsPath) ? JSON.parse(fs.readFileSync(productsPath, 'utf8')) : [];

        const newItemId = interaction.options.getString('name').toLowerCase().replace(/\s+/g, '-');
        if (products.some(p => p.id === newItemId)) {
            return interaction.editReply({ content: 'Error: A product with this name already exists. Please choose a unique name.' });
        }

        const channel = interaction.options.getChannel('channel');
        const newItemData = {
            id: newItemId,
            name: interaction.options.getString('name'),
            price: interaction.options.getNumber('price'),
            stock: interaction.options.getInteger('stock'),
            description: interaction.options.getString('description'),
            imageUrl: interaction.options.getString('image_url'),
            channelId: channel.id,
            messageId: null // Will be updated after posting
        };

        const embed = new EmbedBuilder()
            .setColor('#1E90FF')
            .setTitle(newItemData.name)
            .setDescription(newItemData.description)
            .addFields(
                { name: 'Harga', value: `Rp ${newItemData.price.toLocaleString('id-ID')}`, inline: true },
                { name: 'Stok', value: `${newItemData.stock}`, inline: true }
            )
            .setImage(newItemData.imageUrl)
            .setFooter({ text: 'Klik tombol beli untuk membeli item ini' });
            
        const purchaseButton = new ButtonBuilder()
            .setCustomId(`purchase_initiate_${newItemData.id}`)
            .setLabel('Beli Sekarang')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🛒');

        const row = new ActionRowBuilder().addComponents(purchaseButton);

        try {
            const message = await channel.send({ embeds: [embed], components: [row] });
            newItemData.messageId = message.id; // Save the message ID

            products.push(newItemData);
            interaction.client.products.push(newItemData); // Update live state
            fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));

            await interaction.editReply({ content: `✅ Successfully posted and saved the product "${newItemData.name}".` });
        } catch (error) {
            console.error('Failed to post item:', error);
            await interaction.editReply({ content: 'An error occurred while trying to post the item. Please check my permissions.' });
        }
    },
};