import { Fragment } from 'react';
import Link from 'next/link';
import { CaretRight } from '@phosphor-icons/react/ssr';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface BreadcrumbCrumb {
  label: string;
  href?: string;
}

interface Props {
  items: BreadcrumbCrumb[];
  className?: string;
}

export function WorkspaceBreadcrumbs({ items, className }: Props) {
  if (items.length === 0) return null;
  return (
    <Breadcrumb className={className}>
      <BreadcrumbList className="text-sm text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <Fragment key={`${item.label}-${index}`}>
              <BreadcrumbItem>
                {isLast || !item.href ? (
                  <BreadcrumbPage className="truncate max-w-[40ch] text-foreground">
                    {item.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={item.href} className="truncate max-w-[24ch]">
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? (
                <BreadcrumbSeparator>
                  <CaretRight size={12} weight="regular" aria-hidden />
                </BreadcrumbSeparator>
              ) : null}
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
