import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-black text-primary-600">EC</h1>
        <p className="mt-1 text-lg text-text-secondary">Just Easy.</p>
      </div>

      <Card className="w-full">
        <CardHeader>
          <CardTitle>Platform status</CardTitle>
          <CardDescription>Web foundation is up. API base: <code>/api/v1/</code></CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Badge>Elder</Badge>
          <Badge variant="accent">Family</Badge>
          <Badge variant="danger">Emergency</Badge>
          <Badge variant="success">Provider</Badge>
          <Badge variant="muted">Admin</Badge>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary">Primary action</Button>
        <Button variant="accent">Accent action</Button>
        <Button variant="danger">Need help now</Button>
        <Button variant="outline">Secondary</Button>
      </div>
    </main>
  );
}
