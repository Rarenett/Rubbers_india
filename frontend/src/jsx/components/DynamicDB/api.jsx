/**
 * API service for Dynamic Database Designer.
 * Uses the project's shared axiosInstance (src/services/AxiosInstance.js)
 * which already handles:
 *   - Reading JWT from localStorage key "userDetails" → { access, refresh, user }
 *   - Sending Authorization: Bearer <token> header
 *   - Redirecting to /login on 401 (expired token)
 *   - Using REACT_APP_BACKEND_URL as the base URL
 */
import axiosInstance from '../../../services/AxiosInstance';

// ─── Schema Management ────────────────────────────────────────────────────────

/** GET /api/dynamic-db/tables/ → list all managed tables */
export const fetchTables = () =>
  axiosInstance.get('/api/dynamic-db/tables/');

/** GET /api/dynamic-db/tables/<name>/ → table detail + fields + mysql_structure */
export const fetchTableDetail = (tableName) =>
  axiosInstance.get(`/api/dynamic-db/tables/${tableName}/`);

/** POST /api/dynamic-db/tables/ → create table
 *  body: { table_name, description, fields: [...] }
 */
export const createTable = (payload) =>
  axiosInstance.post('/api/dynamic-db/tables/', payload);

/** DELETE /api/dynamic-db/tables/<name>/ → drop table + metadata */
export const deleteTable = (tableName) =>
  axiosInstance.delete(`/api/dynamic-db/tables/${tableName}/`);

/** POST /api/dynamic-db/tables/<name>/columns/ → add a column */
export const addColumn = (tableName, fieldPayload) =>
  axiosInstance.post(`/api/dynamic-db/tables/${tableName}/columns/`, fieldPayload);

/** PUT /api/dynamic-db/tables/<name>/columns/<col>/ → modify or rename column */
export const modifyColumn = (tableName, columnName, payload) =>
  axiosInstance.put(
    `/api/dynamic-db/tables/${tableName}/columns/${columnName}/`,
    payload
  );

/** DELETE /api/dynamic-db/tables/<name>/columns/<col>/ → drop column */
export const dropColumn = (tableName, columnName) =>
  axiosInstance.delete(
    `/api/dynamic-db/tables/${tableName}/columns/${columnName}/`
  );

/** GET /api/dynamic-db/mysql-tables/ → raw MySQL table list */
export const fetchMysqlTables = () =>
  axiosInstance.get('/api/dynamic-db/mysql-tables/');

// ─── Generic CRUD ─────────────────────────────────────────────────────────────

/** GET /api/dynamic/<table>/?limit=&offset=&ordering= */
export const fetchRows = (tableName, params = {}) =>
  axiosInstance.get(`/api/dynamic/${tableName}/`, { params });

/** GET /api/dynamic/<table>/<pk>/ */
export const fetchRow = (tableName, pk) =>
  axiosInstance.get(`/api/dynamic/${tableName}/${pk}/`);

/** POST /api/dynamic/<table>/ */
export const insertRow = (tableName, data) =>
  axiosInstance.post(`/api/dynamic/${tableName}/`, data);

/** PUT /api/dynamic/<table>/<pk>/ */
export const updateRow = (tableName, pk, data) =>
  axiosInstance.put(`/api/dynamic/${tableName}/${pk}/`, data);

/** DELETE /api/dynamic/<table>/<pk>/ */
export const deleteRow = (tableName, pk) =>
  axiosInstance.delete(`/api/dynamic/${tableName}/${pk}/`);
