import type { Metadata } from "next";
import { WeddingJourneyPage } from "@/components/wedding/WeddingJourneyPage";
import "@/components/wedding/wedding.css";

export const metadata: Metadata = { title: "Our Road to Forever | yushef" };

export default function OurWeddingPage() { return <WeddingJourneyPage />; }
