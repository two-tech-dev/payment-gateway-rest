import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { UserModel } from "../models/User";
import { signToken, jwtGuard } from "../middleware/jwtAuth";

const loginSchema = z.object({
    email: z.string().email("Email khong hop le"),
    password: z.string().min(1, "Mat khau khong duoc de trong"),
});

export default async function authRoutes(
    fastify: FastifyInstance,
): Promise<void> {
    // POST /api/auth/login
    fastify.post("/auth/login", async (request, reply) => {
        const parseResult = loginSchema.safeParse(request.body);

        if (!parseResult.success) {
            return reply.code(400).send({
                success: false,
                message: "Thong tin dang nhap khong hop le",
                issues: parseResult.error.flatten(),
            });
        }

        const { email, password } = parseResult.data;

        try {
            const user = await UserModel.findOne({ email: email.toLowerCase() });

            if (!user) {
                return reply.code(401).send({
                    success: false,
                    message: "Email hoac mat khau khong dung",
                });
            }

            const isValidPassword = await user.comparePassword(password);

            if (!isValidPassword) {
                return reply.code(401).send({
                    success: false,
                    message: "Email hoac mat khau khong dung",
                });
            }

            const token = signToken({
                userId: user._id.toString(),
                email: user.email,
            });

            return reply.send({
                success: true,
                user: {
                    email: user.email,
                    name: user.name,
                },
                token,
            });
        } catch (error) {
            request.log.error({ err: error }, "Dang nhap that bai");
            return reply.code(500).send({
                success: false,
                message: "Khong the dang nhap",
            });
        }
    });

    // POST /api/auth/logout
    fastify.post("/auth/logout", async (_request, reply) => {
        // For JWT, logout is typically handled client-side by removing the token
        return reply.send({
            success: true,
            message: "Dang xuat thanh cong",
        });
    });

    // GET /api/auth/me
    fastify.get(
        "/auth/me",
        { preHandler: jwtGuard },
        async (request, reply) => {
            try {
                const user = await UserModel.findById(request.user?.userId).select(
                    "-password",
                );

                if (!user) {
                    return reply.code(404).send({
                        message: "Khong tim thay nguoi dung",
                    });
                }

                return reply.send({
                    email: user.email,
                    name: user.name,
                });
            } catch (error) {
                request.log.error({ err: error }, "Lay thong tin user that bai");
                return reply.code(500).send({
                    message: "Khong the lay thong tin nguoi dung",
                });
            }
        },
    );
}
