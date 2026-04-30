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

-- Data for Name: user_production_line_rights; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.user_production_line_rights (id, user_id, production_line_id, can_view, can_edit, can_publish, created_at) VALUES (1, 4, 1, true, true, true, '2026-04-11 13:50:14.905344');
INSERT INTO public.user_production_line_rights (id, user_id, production_line_id, can_view, can_edit, can_publish, created_at) VALUES (2, 4, 2, true, true, true, '2026-04-11 13:50:14.905344');
INSERT INTO public.user_production_line_rights (id, user_id, production_line_id, can_view, can_edit, can_publish, created_at) VALUES (3, 4, 3, true, true, true, '2026-04-11 13:50:14.905344');
INSERT INTO public.user_production_line_rights (id, user_id, production_line_id, can_view, can_edit, can_publish, created_at) VALUES (4, 4, 4, true, true, true, '2026-04-11 13:50:14.905344');
INSERT INTO public.user_production_line_rights (id, user_id, production_line_id, can_view, can_edit, can_publish, created_at) VALUES (9, 6, 1, true, true, true, '2026-04-26 12:04:45.106871');
INSERT INTO public.user_production_line_rights (id, user_id, production_line_id, can_view, can_edit, can_publish, created_at) VALUES (10, 6, 2, true, true, true, '2026-04-26 12:04:45.106871');
INSERT INTO public.user_production_line_rights (id, user_id, production_line_id, can_view, can_edit, can_publish, created_at) VALUES (11, 6, 3, true, true, true, '2026-04-26 12:04:45.106871');
INSERT INTO public.user_production_line_rights (id, user_id, production_line_id, can_view, can_edit, can_publish, created_at) VALUES (12, 6, 4, true, true, true, '2026-04-26 12:04:45.106871');


--
