'use strict';
// @ts-ignore

const stripe = require('stripe')(process.env.STRIPE_KEY);

/**
 * order controller
 */

// import { factories } from '@strapi/strapi';
const { createCoreController } = require ("@strapi/strapi").factories;

module.exports = createCoreController('api::order.order', ({ strapi }) => ({
    async create(ctx) {
        const { products } = ctx.request.body;

        try {
            if (!products || !Array.isArray(products)) {
                ctx.response.status = 400;
                return { error: 'Invalid products array' };
            }

            const productIds = products.map((p) => p.id);
            const items = await strapi.service("api::product.product").find({
                filters: { id: { $in: productIds } },
            });

            const lineItem = products.map((product) => {
                const item = items.results.find((i) => i.id === product.id);
                if (!item) {
                    throw new Error(`Product not found: ${product.id}`);
                }
            
                console.log(`Comparando Producto ID: ${product.id}`);
                console.log(`Base de datos - Nombre: ${item.productName}, Precio: ${item.price}`);
                console.log(`Recibido - Nombre: ${product.name}, Precio: ${product.price}`);
            
                if (item.price !== product.price || item.productName !== product.name) {
                    throw new Error(`Product data mismatch for ID: ${product.id}`);
                }
            
                return {
                    price_data: {
                        currency: 'brl',
                        product_data: {
                            name: item.productName,
                        },
                        unit_amount: Math.round(item.price * 100),
                    },
                    quantity: product.quantity || 1,
                };
            });
            
            const session = await stripe.checkout.sessions.create({
                shipping_address_collection: { allowed_countries: ["BR"] },
                payment_method_types: ["card"],
                mode: "payment",
                line_items: lineItem,
                success_url: `${process.env.CLIENT_URL}/success`,
                cancel_url: `${process.env.CLIENT_URL}/cancel`,
            });

            await strapi.service("api::order.order").create({
                data: { products, stripeId: session.id },
            });

            return { stripeSession: session };

        } catch (error) {
            console.error(error);
            ctx.response.status = error.type === 'StripeCardError' ? 400 : 500;
            return { error: error.message || 'Internal Server Error' };
        }
    }
}));
