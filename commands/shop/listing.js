const { SlashCommandBuilder, PermissionsBitField, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Helper to update the embed in the shop channel
async function updateListingMessage(interaction, product) {
    try {
        const channel = await interaction.client.channels.fetch(product.channelId);
        const message = await channel.messages.fetch(product.messageId);
        
        const isOutOfStock = product.variants.every(v => v.stock <= 0);
        
        // Build the enhanced embed description with features and notes
        let embedDescription = product.description;
        
        // Add features if they exist
        if (product.features && product.features.length > 0) {
            embedDescription += `\n\n${product.features.map(f => `✅ - ${f}`).join('\n')}`;
        }
        
        // Add price section
        embedDescription += `\n\n**Price:**\n${product.variants.map(v => `> **${v.name}** : Rp ${v.price.toLocaleString('id-ID')} (Stok: ${v.stock})`).join('\n')}`;
        
        // Add notes if they exist
        if (product.notes) {
            embedDescription += `\n\n**Note:**\n${product.notes}`;
        }
        
        const newEmbed = new EmbedBuilder()
            .setColor('#1E90FF')
            .setTitle(product.title)
            .setDescription(embedDescription)
            .setImage(product.imageUrl)
            .setFooter({ text: 'Klik tombol di bawah untuk membeli salah satu item dari daftar ini.' });

        const oldButton = message.components[0].components[0];
        const newButton = ButtonBuilder.from(oldButton).setDisabled(isOutOfStock);
        await message.edit({ embeds: [newEmbed], components: [new ActionRowBuilder().addComponents(newButton)] });

    } catch (error) { 
        console.error(`Could not update listing message for ${product.id}:`, error); 
    }
}

// --- SUBCOMMAND HANDLERS ---

async function handleCreate(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const productsPath = path.join(__dirname, '../../products.json');
    const products = interaction.client.products;

    const title = interaction.options.getString('title');
    const variantsInput = interaction.options.getString('variants');
    const featuresInput = interaction.options.getString('features');
    const notes = interaction.options.getString('notes');

    // Parse features
    const features = featuresInput ? featuresInput.split(';').map(f => f.trim()) : [];

    // Parse variants
    const variants = [];
    const variantEntries = variantsInput.split(';');
    for (const entry of variantEntries) {
        const [name, priceStr, stockStr] = entry.split(',');
        if (!name || !priceStr || !stockStr) return interaction.editReply({ content: `Invalid variant format: \`${entry}\`.` });
        const price = parseFloat(priceStr);
        const stock = parseInt(stockStr, 10);
        if (isNaN(price) || isNaN(stock)) return interaction.editReply({ content: `Invalid price/stock in \`${entry}\`.` });
        variants.push({ name: name.trim(), price, stock });
    }

    const listingId = title.toLowerCase().replace(/\s+/g, '-');
    if (products.some(p => p.id === listingId)) {
        return interaction.editReply({ content: 'A listing with this title already exists.' });
    }

    const channel = interaction.options.getChannel('channel');
    const newListingData = {
        id: listingId, 
        title, 
        variants,
        features,
        notes,
        description: interaction.options.getString('description').replace(/\\n/g, '\n'),
        imageUrl: interaction.options.getString('image_url'),
        channelId: channel.id, 
        messageId: null, 
        totalSold: 0, 
        ratings: []
    };

    // Build the enhanced embed description
    let embedDescription = newListingData.description;
    
    // Add features
    if (newListingData.features.length > 0) {
        embedDescription += `\n\n${newListingData.features.map(f => `✅ - ${f}`).join('\n')}`;
    }
    
    // Add price section
    embedDescription += `\n\n**Price:**\n${newListingData.variants.map(v => `> **${v.name}** : Rp ${v.price.toLocaleString('id-ID')} (Stok: ${v.stock})`).join('\n')}`;
    
    // Add notes
    if (newListingData.notes) {
        embedDescription += `\n\n**Note:**\n${newListingData.notes}`;
    }

    const embed = new EmbedBuilder()
        .setColor('#1E90FF')
        .setTitle(newListingData.title)
        .setDescription(embedDescription)
        .setImage(newListingData.imageUrl)
        .setFooter({ text: 'Klik tombol di bawah untuk membeli salah satu item dari daftar ini.' });
        
    const purchaseButton = new ButtonBuilder()
        .setCustomId(`purchase_initiate_${newListingData.id}`)
        .setLabel('Beli Sekarang')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🛒');
    
    try {
        const message = await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(purchaseButton)] });
        newListingData.messageId = message.id;
        products.push(newListingData);
        fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
        await interaction.editReply({ content: `✅ Successfully posted and saved the listing "${newListingData.title}".` });
    } catch (error) {
        console.error('Failed to post listing:', error);
        await interaction.editReply({ content: 'An error occurred while posting the listing.' });
    }
}

async function handleAddVariant(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const productsPath = path.join(__dirname, '../../products.json');
    const products = interaction.client.products;
    
    const listingId = interaction.options.getString('listing');
    const productIndex = products.findIndex(p => p.id === listingId);
    if (productIndex === -1) return interaction.editReply('Listing not found.');

    const name = interaction.options.getString('name');
    const price = interaction.options.getNumber('price');
    const stock = interaction.options.getInteger('stock');

    if (products[productIndex].variants.some(v => v.name.toLowerCase() === name.toLowerCase())) {
        return interaction.editReply('A variant with this name already exists in the listing.');
    }

    products[productIndex].variants.push({ name, price, stock });
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
    await updateListingMessage(interaction, products[productIndex]);
    await interaction.editReply('✅ Variant successfully added.');
}

async function handleEditVariant(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const productsPath = path.join(__dirname, '../../products.json');
    const products = interaction.client.products;

    const listingId = interaction.options.getString('listing');
    const variantName = interaction.options.getString('variant');
    const newPrice = interaction.options.getNumber('new_price');
    const newStock = interaction.options.getInteger('new_stock');

    const productIndex = products.findIndex(p => p.id === listingId);
    if (productIndex === -1) return interaction.editReply('Listing not found.');

    const variantIndex = products[productIndex].variants.findIndex(v => v.name === variantName);
    if (variantIndex === -1) return interaction.editReply('Variant not found in this listing.');

    if (newPrice !== null) products[productIndex].variants[variantIndex].price = newPrice;
    if (newStock !== null) products[productIndex].variants[variantIndex].stock = newStock;
    
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
    await updateListingMessage(interaction, products[productIndex]);
    await interaction.editReply('✅ Variant successfully updated.');
}

async function handleRemoveVariant(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const productsPath = path.join(__dirname, '../../products.json');
    const products = interaction.client.products;

    const listingId = interaction.options.getString('listing');
    const variantName = interaction.options.getString('variant');

    const productIndex = products.findIndex(p => p.id === listingId);
    if (productIndex === -1) return interaction.editReply('Listing not found.');
    
    const originalLength = products[productIndex].variants.length;
    products[productIndex].variants = products[productIndex].variants.filter(v => v.name !== variantName);

    if (products[productIndex].variants.length === originalLength) {
        return interaction.editReply('Variant not found in this listing.');
    }

    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
    await updateListingMessage(interaction, products[productIndex]);
    await interaction.editReply('✅ Variant successfully removed.');
}

async function handleUpdate(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const productsPath = path.join(__dirname, '../../products.json');
    const products = interaction.client.products;
    
    const listingId = interaction.options.getString('listing');
    const productIndex = products.findIndex(p => p.id === listingId);
    if (productIndex === -1) return interaction.editReply('Listing not found.');

    const newTitle = interaction.options.getString('new_title');
    const newDescription = interaction.options.getString('new_description');
    const newImageUrl = interaction.options.getString('new_image_url');
    const newFeatures = interaction.options.getString('new_features');
    const newNotes = interaction.options.getString('new_notes');

    if (newTitle) products[productIndex].title = newTitle;
    if (newDescription) products[productIndex].description = newDescription.replace(/\\n/g, '\n');
    if (newImageUrl) products[productIndex].imageUrl = newImageUrl;
    if (newFeatures) products[productIndex].features = newFeatures.split(';').map(f => f.trim());
    if (newNotes !== null) products[productIndex].notes = newNotes; // Allow clearing notes with empty string
    
    fs.writeFileSync(productsPath, JSON.stringify(products, null, 2));
    await updateListingMessage(interaction, products[productIndex]);
    await interaction.editReply('✅ Listing details successfully updated.');
}

async function handleDelete(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const listingIdToRemove = interaction.options.getString('listing');
    const productsPath = path.join(__dirname, '../../products.json');

    let products = interaction.client.products;
    const listingToRemove = products.find(p => p.id === listingIdToRemove);
    
    if (!listingToRemove) {
        return interaction.editReply({ content: 'Error: Listing not found.' });
    }

    const updatedProducts = products.filter(p => p.id !== listingIdToRemove);
    interaction.client.products.splice(0, interaction.client.products.length, ...updatedProducts);
    fs.writeFileSync(productsPath, JSON.stringify(updatedProducts, null, 2));

    try {
        const channel = await interaction.client.channels.fetch(listingToRemove.channelId);
        const message = await channel.messages.fetch(listingToRemove.messageId);
        await message.delete();
        await interaction.editReply({ content: '✅ Successfully removed the listing and its shop message.' });
    } catch (error) {
        console.error("Failed to delete listing message:", error);
        await interaction.editReply({ content: '✅ Listing removed from the database, but I failed to delete its message.' });
    }
}

module.exports = {
    isAdmin: true,
    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        const products = interaction.client.products;

        if (focused.name === 'listing') {
            const choices = products.map(p => ({ name: p.title, value: p.id }));
            const filtered = choices.filter(choice => choice.name.toLowerCase().startsWith(focused.value.toLowerCase()));
            await interaction.respond(filtered.slice(0, 25));
        }

        if (focused.name === 'variant') {
            const listingId = interaction.options.getString('listing');
            const listing = products.find(p => p.id === listingId);
            if (!listing) return await interaction.respond([]);
            const choices = listing.variants.map(v => ({ name: v.name, value: v.name }));
            const filtered = choices.filter(choice => choice.name.toLowerCase().startsWith(focused.value.toLowerCase()));
            await interaction.respond(filtered.slice(0, 25));
        }
    },
    data: new SlashCommandBuilder()
        .setName('listing')
        .setDescription('[Admin] Manages product listings in the shop.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(sub => sub.setName('create').setDescription('Creates a new product listing.')
            .addChannelOption(o => o.setName('channel').setDescription('Shop channel to post in').setRequired(true).addChannelTypes(ChannelType.GuildText))
            .addStringOption(o => o.setName('title').setDescription('Main title for the listing').setRequired(true))
            .addStringOption(o => o.setName('description').setDescription('A short opening description.').setRequired(true))
            .addStringOption(o => o.setName('features').setDescription('List of features, separated by semicolons (;)').setRequired(true))
            .addStringOption(o => o.setName('variants').setDescription('Variants in format: Name,Price,Stock; Name2,Price2,Stock2').setRequired(true))
            .addStringOption(o => o.setName('image_url').setDescription('URL for the listing image').setRequired(true))
            .addStringOption(o => o.setName('notes').setDescription('Additional notes at the bottom of the listing.'))
        )
        .addSubcommand(sub => sub.setName('addvariant').setDescription('Adds a new variant to an existing listing.')
            .addStringOption(o => o.setName('listing').setDescription('The listing to modify').setRequired(true).setAutocomplete(true))
            .addStringOption(o => o.setName('name').setDescription('Name of the new variant').setRequired(true))
            .addNumberOption(o => o.setName('price').setDescription('Price of the new variant').setRequired(true))
            .addIntegerOption(o => o.setName('stock').setDescription('Stock of the new variant').setRequired(true))
        )
        .addSubcommand(sub => sub.setName('editvariant').setDescription('Edits an existing variant.')
            .addStringOption(o => o.setName('listing').setDescription('The listing to modify').setRequired(true).setAutocomplete(true))
            .addStringOption(o => o.setName('variant').setDescription('The variant to edit').setRequired(true).setAutocomplete(true))
            .addNumberOption(o => o.setName('new_price').setDescription('The new price').setRequired(false))
            .addIntegerOption(o => o.setName('new_stock').setDescription('The new stock count').setRequired(false))
        )
        .addSubcommand(sub => sub.setName('removevariant').setDescription('Removes a variant from a listing.')
            .addStringOption(o => o.setName('listing').setDescription('The listing to modify').setRequired(true).setAutocomplete(true))
            .addStringOption(o => o.setName('variant').setDescription('The variant to remove').setRequired(true).setAutocomplete(true))
        )
        .addSubcommand(sub => sub.setName('update').setDescription('Updates the general info of a listing.')
            .addStringOption(o => o.setName('listing').setDescription('The listing to update').setRequired(true).setAutocomplete(true))
            .addStringOption(o => o.setName('new_title').setDescription('The new main title'))
            .addStringOption(o => o.setName('new_description').setDescription('The new description'))
            .addStringOption(o => o.setName('new_image_url').setDescription('The new image URL'))
            .addStringOption(o => o.setName('new_features').setDescription('The new features list (separated by semicolons)'))
            .addStringOption(o => o.setName('new_notes').setDescription('The new notes'))
        )
        .addSubcommand(sub => sub.setName('delete').setDescription('Deletes an entire listing.')
            .addStringOption(o => o.setName('listing').setDescription('The listing to delete').setRequired(true).setAutocomplete(true))
        ),
    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === 'create') await handleCreate(interaction);
        else if (subcommand === 'addvariant') await handleAddVariant(interaction);
        else if (subcommand === 'editvariant') await handleEditVariant(interaction);
        else if (subcommand === 'removevariant') await handleRemoveVariant(interaction);
        else if (subcommand === 'update') await handleUpdate(interaction);
        else if (subcommand === 'delete') await handleDelete(interaction);
    },
};