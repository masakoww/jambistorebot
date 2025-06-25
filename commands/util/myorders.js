const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('myorders')
        .setDescription('View your past completed orders.'),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const userOrders = interaction.client.orders.filter(
            order => order.userId === interaction.user.id && order.status === 'completed'
        );

        if (userOrders.length === 0) {
            return interaction.editReply({ content: "You have no completed orders." });
        }

        // Pagination logic
        const pageSize = 5;
        let currentPage = 0;
        const totalPages = Math.ceil(userOrders.length / pageSize);

        const generateEmbed = (page) => {
            const start = page * pageSize;
            const end = start + pageSize;
            const currentOrders = userOrders.slice(start, end);

            return new EmbedBuilder()
                .setTitle('Your Order History')
                .setColor('#1ABC9C')
                .setDescription(currentOrders.map(order => 
                    `**Product:** ${order.productName}\n` +
                    `**ID:** \`${order.orderId}\`\n` +
                    `**Date:** <t:${Math.floor(new Date(order.closedAt).getTime() / 1000)}:f>`
                ).join('\n\n'))
                .setFooter({ text: `Page ${page + 1} of ${totalPages}` });
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('prev_page').setLabel('Previous').setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId('next_page').setLabel('Next').setStyle(ButtonStyle.Secondary).setDisabled(totalPages <= 1)
        );

        const message = await interaction.editReply({
            embeds: [generateEmbed(currentPage)],
            components: [row]
        });

        const collector = message.createMessageComponentCollector({ time: 60000 });

        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                return i.reply({ content: 'This is not for you!', ephemeral: true });
            }

            if (i.customId === 'prev_page') {
                currentPage--;
            } else if (i.customId === 'next_page') {
                currentPage++;
            }
            
            row.components[0].setDisabled(currentPage === 0);
            row.components[1].setDisabled(currentPage >= totalPages - 1);

            await i.update({
                embeds: [generateEmbed(currentPage)],
                components: [row]
            });
        });

        collector.on('end', () => {
            message.edit({ components: [] }).catch(() => {});
        });
    },
};