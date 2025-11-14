'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from '../admin.module.css';
import { apiPost, apiPut } from '../../../lib/api';

type Props = {
  token?: string | null;
  product?: any | null;
  onSaved?: (prod: any) => void;
  onCancel?: () => void;
};

export default function ProductForm({
  token,
  product,
  onSaved,
  onCancel,
}: Props) {
  const [name, setName] = useState(product?.name || '');
  const [desc, setDesc] = useState(product?.description || '');
  const [price, setPrice] = useState<number | ''>(product?.price ?? '');
  const [stock, setStock] = useState<number>(product?.stock ?? 0);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<string[]>(product?.images || []);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setName(product?.name || '');
    setDesc(product?.description || '');
    setPrice(product?.price ?? '');
    setStock(product?.stock ?? 0);
    setFiles([]);
    setPreview(product?.images || []);
    if (fileRef.current) fileRef.current.value = '';
  }, [product]);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = e.target.files ? Array.from(e.target.files) : [];
    setFiles(fl);
    setPreview((prev) => [...prev, ...fl.map((f) => URL.createObjectURL(f))]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || price === '') return alert('Fill name & price');
    setSaving(true);
    try {
      const form = new FormData();
      form.append('name', name);
      form.append('description', desc);
      form.append('price', String(price));
      form.append('stock', String(stock));
      files.forEach((f) => form.append('files', f));

      let res;
      if (product && product._id) {
        res = await apiPut(
          `/products/${product._id}`,
          form,
          token || undefined
        );
      } else {
        res = await apiPost('/products', form, token || undefined);
      }

      const prod = (res && (res.product || res)) || null;
      if (!prod) alert('Saved but backend responded unexpectedly');
      else onSaved && onSaved(prod);
    } catch (err) {
      console.error(err);
      alert('Save failed');
    } finally {
      setSaving(false);
      setFiles([]);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className={styles.card}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3>{product ? 'Edit product' : 'Add product'}</h3>
          {onCancel ? (
            <button type="button" onClick={onCancel} className="smallBtn">
              Cancel
            </button>
          ) : null}
        </div>

        <label>Product name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <label>Description</label>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          rows={3}
        />

        <div className={styles.row}>
          <div className="col">
            <label>Price (INR)</label>
            <input
              type="number"
              step="0.01"
              value={price as any}
              onChange={(e) => setPrice(Number(e.target.value) || '')}
              required
            />
          </div>
          <div style={{ width: 120 }}>
            <label>Stock</label>
            <input
              type="number"
              value={stock}
              onChange={(e) => setStock(Number(e.target.value) || 0)}
            />
          </div>
        </div>

        <label>Images (multiple)</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
        />

        <div className={styles.previewWrap}>
          {preview.map((p, i) => (
            <div className={styles.previewThumb} key={i}>
              <img src={p} alt={`preview-${i}`} />
            </div>
          ))}
        </div>

        <div className={styles.formActions} style={{ marginTop: 10 }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </form>
    </div>
  );
}
