import "next-auth";

declare module "next-auth" {
    interface Session {
        /** OAuth access token — populated by the jwt callback in [...nextauth].ts */
        accessToken?: string;
    }
}
