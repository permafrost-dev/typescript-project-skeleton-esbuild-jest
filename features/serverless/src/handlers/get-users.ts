/* eslint-disable @typescript-eslint/no-unused-vars */
export async function handler(event: any, context: any) {
    const body = JSON.stringify({
        users: [
            {
                id: '1',
                name: 'User 1',
                email: 'user1@example.com',
            },
            {
                id: '2',
                name: 'User 2',
                email: 'user2@example.com',
            },
        ],
    });

    const headers = { 'content-length': body.length };

    return { body, headers, statusCode: 200 };
}
