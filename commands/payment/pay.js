const { EmbedBuilder } = require('discord.js');
const { isAdmin } = require('../shop/postitem');

const paymentMethods = {
    'bca': '**BCA**\nAccount Holder: JOHN DOE\nAccount Number: 1234567890',
    'bri': '**BRI**\nAccount Holder: JANE DOE\nAccount Number: 0987654321',
    'dana': '**DANA**\nAccount Holder: JOHN DOE\nPhone Number: 081234567890',
    'gopay': '**GOPAY**\nAccount Holder: JOHN DOE\nPhone Number: 081234567890',
    'ovo': '**OVO**\nAccount Holder: JOHN DOE\nPhone Number: 081234567890',
    'linkaja': '**LINKAJA**\nAccount Holder: JOHN DOE\nPhone Number: 081234567890',
    'shopeepay': '**SHOPEEPAY**\nAccount Holder: JOHN DOE\nPhone Number: 081234567890',
    'qris': '**QRIS**\n[https://media.discordapp.net/attachments/968201737087365230/1386674213447929967/image.png?ex=685be1ff&is=685a907f&hm=6f28c9c413a20672be00484923edb96022b3af1944f17004e8aafd10e88d1b70&=&format=webp&quality=lossless&width=478&height=673]', // Replace with a real image link for production
};

module.exports = {
    isAdmin: true,
    name: 'pay',
    description: 'Displays payment details for a specific method.',
    execute(message, args) {
        if (!message.channel.name.startsWith('ticket-')) return;
        
        const method = args[0]?.toLowerCase();
        if (!method) {
            return message.reply(`Please specify a payment method. Available: \`${Object.keys(paymentMethods).join(', ')}\``);
        }

        const details = paymentMethods[method];
        if (!details) {
            return message.reply(`Invalid payment method. Available: \`${Object.keys(paymentMethods).join(', ')}\``);
        }

        message.reply(details);
    }
};