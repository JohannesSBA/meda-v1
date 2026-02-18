import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const { eventName, category, description, startDate, endDate, location, longitude, latitude, image, capacity, price, userId } = await request.json();
    const { categoryId } = category;
    const event = await prisma.event.create({
        data: {
            eventName,
            categoryId,
            description,
            eventDatetime: new Date(startDate),
            eventEndtime: new Date(endDate),
            eventLocation: `${location}!longitude=${longitude}&latitude=${latitude}`,
            pictureUrl: image,
            capacity: parseInt(capacity),
            priceField: parseInt(price),
            userId: userId,
        }
    });
    return NextResponse.json({ event }, { status: 201 });
}