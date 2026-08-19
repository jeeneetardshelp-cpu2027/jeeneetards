-- CREATE-ONLY Gate 2. Attribution: 1c06eb34-fbdc-4d3b-a239-39f256f889e8.
-- The reviewed channel uploads intentionally have a NULL playlist source ID.
begin;
do $x$
declare p bigint;v bigint;r record;t text:='PRMO & IOQM Solutions (2018'||chr(8211)||'2022)';
begin
if (select row((select count(*) from public.playlists),(select count(*) from public.videos),(select count(*) from public.playlist_videos),(select count(*) from public.chapters),(select count(*) from public.chapter_class_levels)))<>row(317::bigint,3728::bigint,3734::bigint,242::bigint,92::bigint)
or exists(select 1 from public.playlists where title=t)
or exists(select 1 from public.videos where youtube_video_id=any(array['dows6wBBk3A','3YvuUlM2OHY','2qm5UjRyIcs','X3BWR79DtyU'])) then raise exception 'PRMO/IOQM baseline or reuse mismatch';end if;
insert into public.playlists(title,source_title,description,teacher,channel_id,category_id,subject_id,content_type,language,difficulty,audience_focus)
values(t,t||' (Competishun+ uploads)','Reviewed PRMO and IOQM mathematics olympiad solutions from official Competishun+ channel uploads.','Competishun+',81,3,3,'pyq','hinglish','advanced','Dropper') returning id into p;
insert into public.playlist_learning_goals values(p,3);
insert into public.playlist_class_levels select p,id from public.class_levels where id in(2,3,4);
for r in select * from(values
(1,'dows6wBBk3A','PRMO 2018 Solutions - Questions 1-10','PRMO 2018 SOLUTIONS Q 1 to 10 | Indian Olympiad Qualifier For Mathematics | IAPT | HBCSE',3846),
(2,'3YvuUlM2OHY','PRMO 2019 Solutions - Questions 1-15','PRMO 2019 SOLUTIONS Q 1 to 15 | Pre Regional Mathematics Olympiad | IAPT | HBCSE',4259),
(3,'2qm5UjRyIcs','IOQM 2020 Solutions','IOQM 2020 SOLUTIONS | Indian Olympiad Qualifier For Mathematics | IAPT | HBCSE | PRMO | Competishun',9515),
(4,'X3BWR79DtyU','IOQM 2021-22 Solutions','IOQM 2021 22 Solutions | Indian Olympiad Qualifier for Mathematics',4366))q(n,y,t,s,d) loop
insert into public.videos(youtube_video_id,title,source_title,channel_id,category_id,subject_id,chapter_id,duration_seconds,embedding_status,last_verified_at) values(r.y,r.t,r.s,81,3,3,298,r.d,'allowed',now()) returning id into v;
insert into public.video_learning_goals values(v,3);
insert into public.video_class_levels select v,id from public.class_levels where id in(2,3,4);
insert into public.playlist_videos(playlist_id,video_id,position) values(p,v,r.n);
end loop;
if (select row((select count(*) from public.playlists),(select count(*) from public.videos),(select count(*) from public.playlist_videos),(select count(*) from public.playlist_videos where playlist_id=p),(select count(*) from public.video_class_levels where video_id in(select video_id from public.playlist_videos where playlist_id=p))))<>row(318::bigint,3732::bigint,3738::bigint,4::bigint,12::bigint)
or not exists(select 1 from public.playlists where id=p and youtube_playlist_id is null and title=t and teacher='Competishun+' and channel_id=81 and category_id=3 and subject_id=3)
or (select string_agg(z.youtube_video_id,',' order by m.position) from public.playlist_videos m join public.videos z on z.id=m.video_id where m.playlist_id=p)<>'dows6wBBk3A,3YvuUlM2OHY,2qm5UjRyIcs,X3BWR79DtyU' then raise exception 'PRMO/IOQM postflight mismatch';end if;
end $x$;
commit;
