'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function InviteElderPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!/^\S+@\S+\.\S+$/.test(email) || !name.trim() || !relationship.trim()) {
      setError('Please fill in all fields with a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/family/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ elderEmail: email, elderName: name, relationship }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Could not send invite.');
      }
      setSuccess(true);
      setTimeout(() => router.push('/family'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send invite.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-bold text-text">Invite an elder</h1>
      <p className="mt-1 text-text-secondary">
        They'll see this invite the next time they sign in to EC and can accept it themselves.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Elder's details</CardTitle>
          <CardDescription>We'll link their account to yours once they accept.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Elder's name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Raj Sharma" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Elder's email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="raj.sharma@example.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="relationship">Your relationship to them</Label>
              <Input
                id="relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="Daughter"
              />
            </div>

            {error && <p className="text-sm text-danger-600">{error}</p>}
            {success && <p className="text-sm text-success-600">Invite sent — redirecting...</p>}

            <Button type="submit" disabled={loading} size="lg">
              {loading ? 'Sending...' : 'Send Invite'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
