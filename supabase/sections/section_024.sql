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

-- Data for Name: task_production_line_status; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (4, 24, 1, 'under_construction', '2026-03-12 16:27:48.051347', '2026-03-12 16:27:48.051347', false);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (6, 25, 1, 'under_construction', '2026-03-14 12:16:36.047866', '2026-03-14 12:16:36.047866', false);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (1, 23, 2, 'under_construction', '2026-03-12 16:04:52.90082', '2026-03-14 13:10:44.217905', false);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (8, 26, 2, 'under_construction', '2026-03-14 17:44:20.268615', '2026-03-14 17:44:20.268615', false);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (16, 28, 1, 'completed', '2026-04-24 13:59:33.9398', '2026-04-24 13:59:59.090105', false);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (17, 28, 2, 'completed', '2026-04-24 13:59:40.274225', '2026-04-24 14:11:39.294716', true);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (25, 23, 3, 'under_construction', '2026-04-24 15:43:40.661787', '2026-04-24 15:43:40.661787', true);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (22, 28, 3, 'completed', '2026-04-24 15:40:58.034921', '2026-04-24 15:43:48.730364', true);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (10, 27, 4, 'completed', '2026-04-04 13:09:20.604778', '2026-04-24 16:37:46.438784', false);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (11, 27, 2, 'completed', '2026-04-04 14:38:09.301311', '2026-04-24 18:42:16.034307', true);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (42, 25, 3, 'under_construction', '2026-04-25 11:06:56.501679', '2026-04-25 11:06:56.501679', true);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (5, 25, 2, 'under_construction', '2026-03-14 12:10:14.671197', '2026-04-25 11:07:20.951852', true);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (48, 29, 1, 'under_construction', '2026-04-26 12:32:07.502314', '2026-04-26 12:32:07.502314', false);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (49, 30, 2, 'under_construction', '2026-04-26 12:42:14.338285', '2026-04-26 15:25:31.814177', true);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (52, 24, 4, 'under_construction', '2026-04-29 09:07:39.718812', '2026-04-29 09:07:39.718812', false);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (53, 25, 4, 'under_construction', '2026-04-29 09:07:39.718812', '2026-04-29 09:07:39.718812', false);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (54, 28, 4, 'under_construction', '2026-04-29 09:07:39.718812', '2026-04-29 09:07:39.718812', false);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (56, 29, 4, 'under_construction', '2026-04-29 09:07:39.718812', '2026-04-29 09:07:39.718812', false);
INSERT INTO public.task_production_line_status (id, task_id, production_line_id, status, created_at, updated_at, wait_for_zk) VALUES (140, 31, 2, 'under_construction', '2026-04-30 09:04:56.603595', '2026-04-30 09:04:56.603595', false);


--
