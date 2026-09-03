import { pool } from '../database/db.js';

export const executeReadSP = async (spCallQuery, params = []) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(spCallQuery, params);
    const cursorName = params.find(p => typeof p === 'string' && p.startsWith('cur_')) || 'cur_katalog';
    const fetchResult = await client.query(`FETCH ALL IN "${cursorName}"`);
    await client.query('COMMIT');
    return fetchResult.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const executeWriteSP = async (spCallQuery, params = []) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(spCallQuery, params);
    await client.query('COMMIT');
    return result.rows[0] || result.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
