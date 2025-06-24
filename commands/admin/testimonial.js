const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
    isSecurityCommand: true, // Reuse authorization logic
    data: new SlashCommandBuilder()
        .setName('testimonial')
        .setDescription('[Admin] Creates and posts a formatted testimonial.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addStringOption(option => option.setName('buyer').setDescription('The name or @ of the buyer.').setRequired(true))
        .addStringOption(option => option.setName('product').setDescription('The name of the product purchased.').setRequired(true))
        .addStringOption(option => option.setName('price').setDescription('The price of the product.').setRequired(true))
        .addAttachmentOption(option => option.setName('image').setDescription('The screenshot proof for the testimonial.').setRequired(true)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const buyer = interaction.options.getString('buyer');
        const product = interaction.options.getString('product');
        const price = interaction.options.getString('price');
        const image = interaction.options.getAttachment('image');

        const testimonialChannelId = interaction.client.feedback.config.testimonialChannelId;
        if (!testimonialChannelId) {
            return interaction.editReply({ content: 'Error: The testimonial channel ID has not been set in the `.env` file.' });
        }

        const testimonialChannel = await interaction.client.channels.fetch(testimonialChannelId).catch(() => null);
        if (!testimonialChannel) {
            return interaction.editReply({ content: 'Error: Could not find the configured testimonial channel.' });
        }

        const embed = new EmbedBuilder()
            .setColor('#7CFC00')
            .setTitle('🌟 New Customer Testimonial 🌟')
            .addFields(
                { name: 'Buyer', value: buyer, inline: true },
                { name: 'Product', value: product, inline: true },
                { name: 'Price', value: price, inline: true }
            )
            .setImage(image.url)
            .setTimestamp()
            .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() });

        try {
            await testimonialChannel.send({ embeds: [embed] });
            await interaction.editReply({ content: 'Successfully posted the testimonial.' });
        } catch (error) {
            console.error('Failed to post testimonial:', error);
            await interaction.editReply({ content: 'An error occurred while trying to post the testimonial.' });
        }
    },
};