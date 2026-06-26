-- RLS políticas de escritura para la tabla torneos
CREATE POLICY "Organizadores insertan torneos de su org"
ON public.torneos FOR INSERT
WITH CHECK (
  public.es_superadmin() OR
  (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'SuperAdmin' OR
  EXISTS (
    SELECT 1 FROM public.miembros_organizacion mo
    WHERE mo.organizacion_id = organizacion_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);

CREATE POLICY "Organizadores actualizan torneos de su org"
ON public.torneos FOR UPDATE
USING (
  public.es_superadmin() OR
  (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'SuperAdmin' OR
  EXISTS (
    SELECT 1 FROM public.miembros_organizacion mo
    WHERE mo.organizacion_id = torneos.organizacion_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);

CREATE POLICY "Organizadores eliminan torneos de su org"
ON public.torneos FOR DELETE
USING (
  public.es_superadmin() OR
  (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'SuperAdmin' OR
  EXISTS (
    SELECT 1 FROM public.miembros_organizacion mo
    WHERE mo.organizacion_id = torneos.organizacion_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);


-- RLS políticas de escritura para la tabla tarifas_torneo
CREATE POLICY "Organizadores insertan tarifas de su org"
ON public.tarifas_torneo FOR INSERT
WITH CHECK (
  public.es_superadmin() OR
  (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'SuperAdmin' OR
  EXISTS (
    SELECT 1 FROM public.torneos t
    JOIN public.miembros_organizacion mo ON mo.organizacion_id = t.organizacion_id
    WHERE t.id = torneo_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);

CREATE POLICY "Organizadores actualizan tarifas de su org"
ON public.tarifas_torneo FOR UPDATE
USING (
  public.es_superadmin() OR
  (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'SuperAdmin' OR
  EXISTS (
    SELECT 1 FROM public.torneos t
    JOIN public.miembros_organizacion mo ON mo.organizacion_id = t.organizacion_id
    WHERE t.id = tarifas_torneo.torneo_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);

CREATE POLICY "Organizadores eliminan tarifas de su org"
ON public.tarifas_torneo FOR DELETE
USING (
  public.es_superadmin() OR
  (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'SuperAdmin' OR
  EXISTS (
    SELECT 1 FROM public.torneos t
    JOIN public.miembros_organizacion mo ON mo.organizacion_id = t.organizacion_id
    WHERE t.id = tarifas_torneo.torneo_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);


-- RLS políticas de escritura para la tabla partidos
CREATE POLICY "Organizadores insertan partidos de su org"
ON public.partidos FOR INSERT
WITH CHECK (
  public.es_superadmin() OR
  (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'SuperAdmin' OR
  EXISTS (
    SELECT 1 FROM public.torneos t
    JOIN public.miembros_organizacion mo ON mo.organizacion_id = t.organizacion_id
    WHERE t.id = torneo_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);

CREATE POLICY "Organizadores actualizan partidos de su org"
ON public.partidos FOR UPDATE
USING (
  public.es_superadmin() OR
  (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'SuperAdmin' OR
  EXISTS (
    SELECT 1 FROM public.torneos t
    JOIN public.miembros_organizacion mo ON mo.organizacion_id = t.organizacion_id
    WHERE t.id = partidos.torneo_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);

CREATE POLICY "Organizadores eliminan partidos de su org"
ON public.partidos FOR DELETE
USING (
  public.es_superadmin() OR
  (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'SuperAdmin' OR
  EXISTS (
    SELECT 1 FROM public.torneos t
    JOIN public.miembros_organizacion mo ON mo.organizacion_id = t.organizacion_id
    WHERE t.id = partidos.torneo_id
    AND mo.usuario_id = auth.uid()
    AND (SELECT rol FROM public.perfiles_usuarios WHERE id = auth.uid()) = 'Organizador'
  )
);
