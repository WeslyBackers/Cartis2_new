--
-- PostgreSQL database dump
--


-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--

-- Data for Name: hpd_projects; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.hpd_projects (id, task_id, production_line_id, project_code, status, synced_to_oracle, oracle_sync_date, oracle_sync_error, created_at, updated_at) VALUES (1, 23, 2, 'I_260001', 'under_construction', false, NULL, NULL, '2026-04-02 15:44:47.866752', '2026-04-02 15:44:47.866752');
INSERT INTO public.hpd_projects (id, task_id, production_line_id, project_code, status, synced_to_oracle, oracle_sync_date, oracle_sync_error, created_at, updated_at) VALUES (2, 24, 1, 'Z_260002', 'under_construction', false, NULL, NULL, '2026-04-02 15:44:47.866752', '2026-04-02 15:44:47.866752');
INSERT INTO public.hpd_projects (id, task_id, production_line_id, project_code, status, synced_to_oracle, oracle_sync_date, oracle_sync_error, created_at, updated_at) VALUES (3, 25, 2, 'I_260003', 'under_construction', false, NULL, NULL, '2026-04-02 15:44:47.866752', '2026-04-02 15:44:47.866752');
INSERT INTO public.hpd_projects (id, task_id, production_line_id, project_code, status, synced_to_oracle, oracle_sync_date, oracle_sync_error, created_at, updated_at) VALUES (4, 26, 2, 'I_260004', 'under_construction', false, NULL, NULL, '2026-04-02 15:44:47.866752', '2026-04-02 15:44:47.866752');
INSERT INTO public.hpd_projects (id, task_id, production_line_id, project_code, status, synced_to_oracle, oracle_sync_date, oracle_sync_error, created_at, updated_at) VALUES (5, 28, 1, 'Z_260006', 'completed', false, NULL, NULL, '2026-04-24 13:59:33.944107', '2026-04-24 13:59:59.105378');
INSERT INTO public.hpd_projects (id, task_id, production_line_id, project_code, status, synced_to_oracle, oracle_sync_date, oracle_sync_error, created_at, updated_at) VALUES (6, 29, 1, 'Z_260007', 'under_construction', false, NULL, NULL, '2026-04-26 12:32:07.506287', '2026-04-26 12:32:07.506287');
INSERT INTO public.hpd_projects (id, task_id, production_line_id, project_code, status, synced_to_oracle, oracle_sync_date, oracle_sync_error, created_at, updated_at) VALUES (7, 30, 2, 'I_260008', 'under_construction', false, NULL, NULL, '2026-04-26 12:42:14.342877', '2026-04-26 12:42:14.342877');
INSERT INTO public.hpd_projects (id, task_id, production_line_id, project_code, status, synced_to_oracle, oracle_sync_date, oracle_sync_error, created_at, updated_at) VALUES (8, 31, 2, 'I_260009', 'under_construction', false, NULL, NULL, '2026-04-30 09:04:56.60626', '2026-04-30 09:04:56.60626');


--
