'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { EmptyState, ErrorAlert, LoadingState, SuccessAlert } from '@/components/ui/alert';

type Copy = { id: string; barcode: string; loans: Array<{ id: string }> };
type Book = { id: string; title: string; author?: string | null; copies: Copy[] };

export default function LibraryPage() {
  const [rows, setRows] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await apiFetch<Book[]>('/library/books'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load the library');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    try {
      await apiFetch('/library/books', {
        method: 'POST',
        json: {
          title: String(data.get('title') || ''),
          author: String(data.get('author') || '') || undefined,
          barcode: String(data.get('barcode') || ''),
        },
      });
      event.currentTarget.reset();
      setOk('Book added');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the book');
    }
  }

  async function loan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setError(null);
    try {
      await apiFetch('/library/loans', {
        method: 'POST',
        json: {
          copyId: String(data.get('copyId') || ''),
          studentId: String(data.get('studentId') || ''),
          dueOn: String(data.get('dueOn') || ''),
        },
      });
      setOk('Loan recorded');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not issue the loan');
    }
  }

  async function returnCopy(loanId: string) {
    setError(null);
    try {
      await apiFetch(`/library/loans/${loanId}/return`, { method: 'POST' });
      setOk('Copy returned');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not return the copy');
    }
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      {ok ? <SuccessAlert>{ok}</SuccessAlert> : null}
      <Card>
        <CardHeader title="Add a book" />
        <CardBody>
          <form className="grid gap-3 md:grid-cols-4" onSubmit={addBook}>
            <Input name="title" placeholder="Title" required />
            <Input name="author" placeholder="Author" />
            <Input name="barcode" placeholder="Barcode" required />
            <Button type="submit">Save</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Issue a loan" />
        <CardBody>
          <form className="grid gap-3 md:grid-cols-4" onSubmit={loan}>
            <Input name="copyId" placeholder="Copy id" required />
            <Input name="studentId" placeholder="Student id" required />
            <Input name="dueOn" type="date" required />
            <Button type="submit">Issue</Button>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Catalogue" />
        <CardBody>
          {loading ? <LoadingState /> : null}
          {!loading && rows.length === 0 ? <EmptyState label="No books yet." /> : null}
          {rows.length > 0 ? (
            <Table>
              <THead>
                <TR>
                  <TH>Title</TH>
                  <TH>Copy</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {rows.flatMap((book) =>
                  book.copies.map((copy) => (
                    <TR key={copy.id}>
                      <TD>
                        {book.title}
                        {book.author ? ` · ${book.author}` : ''}
                      </TD>
                      <TD>
                        {copy.barcode}
                        <div className="text-xs text-slate-500">{copy.id}</div>
                      </TD>
                      <TD>
                        {copy.loans[0] ? (
                          <Button type="button" onClick={() => void returnCopy(copy.loans[0]!.id)}>
                            Return
                          </Button>
                        ) : (
                          'On shelf'
                        )}
                      </TD>
                    </TR>
                  )),
                )}
              </TBody>
            </Table>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
