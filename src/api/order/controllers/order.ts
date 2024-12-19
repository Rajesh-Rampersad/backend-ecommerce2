'use strict';
// @ts-ignore

const stripe = require('stripe')(process.env.STRIPE_KEY);

/**
 * order controller
 */

import { factories } from '@strapi/strapi';
const { createCoreController } = factories;

module.exports = createCoreController('api::order.order', ({ strapi }) => ({
    async create(ctx) {
        // @ts-ignore

        const { products } = ctx.request.body;

        try {
            // Validar que los productos existan
            if (!products || !Array.isArray(products)) {
                ctx.response.status = 400;
                return { error: 'Invalid products array' };
            }

            const lineItem = await Promise.all(
                products.map(async (product) => {
                const item = await strapi.service("api::product.product").findOne(product.id);
                if (!item) {
                    throw new Error(`Product not found: ${product.id}`);
                }
                return {
                    price_data: {
                        currency: 'brl',
                        product_data: {
                            name: item.productName,
                        },
                        unit_amount: Math.round(item.price * 100),
                    },
                    quantity: 1,
                };
            }));

            const session = await stripe.checkout.sessions.create({
                shipping_address_collection: { allowed_countries: ["BR"] },
                payment_method_types: ["card"],
                mode: "payment",
                line_items: lineItem,
                success_url: `${process.env.CLIENT_URL}/success`,
                cancel_url: `${process.env.CLIENT_URL}/cancel`,
            });

            await strapi.service("api::order.order").create({ data: { products, stripeId: session.id } });

            return { stripeSession: session };

        } catch (error) {
            console.error(error);
            ctx.response.status = 500;
            return { error: 'Internal Server Error' };
        }
    }
}));