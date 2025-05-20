import { Button } from "~/components/ui/button";
import type { Route } from "./+types/home";
import { Link } from "react-router";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Inventory Tracking" },
    { name: "description", content: "Inventory Tracking MVP" },
  ];
}

export default function Home() {
  return (
    <div>
      <h1 className="text-3xl font-bold underline">Hello world!</h1>
      <p className="text-lg">Welcome to your new React Router app!</p>
      <p className="text-lg">
        This is a simple example of a React Router app using TypeScript.
        <Button>shadcn button</Button>
        <Link to="/products">
          <Button variant="outline">Explore Products</Button>
        </Link>
      </p>
    </div>
  );
}
