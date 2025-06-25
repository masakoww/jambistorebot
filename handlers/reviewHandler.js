const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

async function sendReviewToChannel(client, review, user, product) {
    const reviewChannelId = client.feedback.config.feedbackLogChannelId;
    if (!reviewChannelId) {
        return console.log("Warning: FEEDBACK_LOG_CHANNEL_ID not set.");
    }
    
    const reviewChannel = client.channels.cache.get(reviewChannelId);
    if (!reviewChannel) {
        return console.error(`Error: Could not find review channel: ${reviewChannelId}`);
    }

    const starRating = '⭐'.repeat(review.rating) + '✩'.repeat(5 - review.rating);
    
    const reviewEmbed = new EmbedBuilder()
        .setColor(review.rating >= 4 ? '#2ECC71' : review.rating >= 3 ? '#FFD700' : '#E74C3C')
        .setTitle('⭐ New Product Review')
        .setDescription(`**${product?.title || 'Unknown Product'}**`)
        .addFields(
            { name: '👤 Customer', value: `${user} (${user.tag})`, inline: true },
            { name: '⭐ Rating', value: `${starRating} (${review.rating}/5)`, inline: true },
            { name: '📝 Review', value: review.comment || 'GG' }
        )
        .setThumbnail(user.displayAvatarURL())
        .setTimestamp();

    try {
        await reviewChannel.send({ embeds: [reviewEmbed] });
    } catch (error) {
        console.error(`Failed to send review to channel:`, error);
    }
}

async function handleFeedbackLeaveReviewClick(interaction) {
    const productId = interaction.customId.split('_')[3];
    if (!productId) {
        return interaction.reply({ content: 'Could not identify the product for this review.', ephemeral: true });
    }

    const modal = new ModalBuilder()
        .setCustomId(`feedback_review_modal_${productId}`)
        .setTitle('Leave Your Product Feedback');
        
    const ratingInput = new TextInputBuilder().setCustomId('rating').setLabel("Rating (1-5 Stars)").setStyle(TextInputStyle.Short).setPlaceholder('Beri kami bintang 5!').setRequired(true).setMaxLength(1);
    const reviewInput = new TextInputBuilder().setCustomId('review').setLabel("Your Review (Optional)").setStyle(TextInputStyle.Paragraph).setRequired(false);
    
    modal.addComponents(new ActionRowBuilder().addComponents(ratingInput), new ActionRowBuilder().addComponents(reviewInput));
    await interaction.showModal(modal);
}

async function handleFeedbackModalSubmit(interaction) {
    await interaction.deferUpdate();
    const productId = interaction.customId.split('_')[3];
    const productIndex = interaction.client.products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
        return interaction.editReply({ content: 'This product seems to no longer exist.', components: [] });
    }

    const rating = parseInt(interaction.fields.getTextInputValue('rating'), 10);
    const reviewText = interaction.fields.getTextInputValue('review') || 'GG';

    if (isNaN(rating) || rating < 1 || rating > 5) {
        return interaction.followUp({ content: 'Invalid rating. Please enter a number between 1 and 5.', ephemeral: true });
    }

    const product = interaction.client.products[productIndex];
    if (!product.ratings) product.ratings = [];
    
    const newRating = { userId: interaction.user.id, username: interaction.user.username, rating, review: reviewText, timestamp: new Date().toISOString() };
    const existingRatingIndex = product.ratings.findIndex(r => r.userId === interaction.user.id);
    
    if (existingRatingIndex !== -1) {
        product.ratings[existingRatingIndex] = newRating;
    } else {
        product.ratings.push(newRating);
    }
    
    fs.writeFileSync(path.join(__dirname, 'products.json'), JSON.stringify(interaction.client.products, null, 2));
    
    await sendReviewToChannel(interaction.client, newRating, interaction.user, product);
    await interaction.editReply({ content: 'Thank you for your valuable feedback!', components: [] });
}

module.exports = {
    handleFeedbackLeaveReviewClick,
    handleFeedbackModalSubmit
};