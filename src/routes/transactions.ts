import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import knex from "knex";
import { z } from "zod";
import { checkSessionIdExists } from "../middleware/check-session-id-exists";

export async function transactionsRoutes(app: FastifyInstance) {
    app.addHook('preHandler', async (request, reply) => {
        console.log(`Request received with sessionId: ${request.cookies.sessionId}`);
    })
    app.get('/', {
        preHandler: [checkSessionIdExists]
    }, async (request) => {
        try {
            const { sessionId } = request.cookies;
            const transactions = await knex('transactions').where('session_id', sessionId).select();
            return {transactions};
        } catch (error) {
            console.error(error);
            throw error;
        }
    })
    app.get('/:id', {
        preHandler: [checkSessionIdExists]
    },async (request) => {
        const getTransactionsParamsSchema = z.object({
            id: z.string().uuid(),
        })
        const {id} = getTransactionsParamsSchema.parse(request.params);

        const { sessionId } = request.cookies;

        const transaction = await knex('transactions').where({'session_id': sessionId, id}).first();

        return { transaction };
    })

    app.get('/summary', {
        preHandler: [checkSessionIdExists]
    },async (request) => {
        const { sessionId } = request.cookies
        const summary = await knex('transactions').where('session_id', sessionId).sum('amount', { as :'amount' }).first();

        return {summary};
    })

    app.post('/', async (request, reply) => {
        try {
            const createTransactionSchema = z.object({
                title: z.string(),
                amount: z.number(),
                type: z.enum(['credit', 'debit']),
            });
            
            const { title, amount, type } = createTransactionSchema.parse(request.body);

            let sessionId = request.cookies.sessionId

            if(!sessionId) {
                sessionId = randomUUID()

                reply.cookie('sessionId', sessionId, {
                    path: '/',
                    maxAge: 60 * 60 * 24 * 7 // 7 days
                })
            }
           await knex('transactions').insert({
                id: randomUUID(),
                 title,
                  amount: type === 'credit' ? amount : amount * -1,
                  session_id: sessionId
                })
            return reply.status(201).send();
        } catch (error) {
            console.error(error);
            throw error;
        }
    })
}