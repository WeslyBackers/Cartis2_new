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

-- Data for Name: product_version_attachments; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.product_version_attachments (id, product_version_id, filename, original_filename, file_path, file_type, file_size, uploaded_by, created_at) VALUES (1, 23, 'Goedkeuringsattest Inland ENC_BE7GT017_ed16.docx_signed_2026-04-22T15_06_00-1777108768986-958312878.pdf', 'Goedkeuringsattest Inland ENC_BE7GT017_ed16.docx_signed_2026-04-22T15_06_00.pdf', 'D:\Programming\Webapps\Cartis_new\backend\uploads\Goedkeuringsattest Inland ENC_BE7GT017_ed16.docx_signed_2026-04-22T15_06_00-1777108768986-958312878.pdf', 'application/pdf', 226461, 4, '2026-04-25 11:19:28.992764');


--
