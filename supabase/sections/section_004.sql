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

-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.users (id, email, password_hash, first_name, last_name, default_production_line_id, is_active, last_login, created_at, updated_at) VALUES (6, 'test@cartis', '$2a$10$Ct4XdaQG0dsh9otDqjC7TeECDJAgLS3EmfwstJ9gccY5XeJAVGNx6', 'Test', 'User', 1, true, '2026-04-26 15:16:01.74343', '2026-04-26 12:04:44.920268', '2026-04-26 12:04:45.015447');
INSERT INTO public.users (id, email, password_hash, first_name, last_name, default_production_line_id, is_active, last_login, created_at, updated_at) VALUES (4, 'test@cartis.be', '$2a$10$Ct4XdaQG0dsh9otDqjC7TeECDJAgLS3EmfwstJ9gccY5XeJAVGNx6', 'Test', 'User', 1, true, '2026-04-30 09:08:33.401853', '2026-01-17 18:12:17.3087', '2026-04-26 12:03:48.668082');


--
