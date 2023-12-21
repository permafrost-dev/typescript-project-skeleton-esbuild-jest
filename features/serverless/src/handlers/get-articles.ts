/* eslint-disable @typescript-eslint/no-unused-vars */
export async function handler(event: any, context: any) {
    const body = JSON.stringify({
        articles: [
            {
                id: '1',
                title: 'Article 1',
                content: 'Article 1 content',
            },
            {
                id: '2',
                title: 'Article 2',
                content: 'Article 2 content',
            },
        ],
    });

    const headers = { 'content-length': body.length };

    return { body, headers, statusCode: 200 };
}
