"use client";

import React, { useState, useEffect } from "react";
import { ModeToggle } from "./theme-toggle";
import Link from "next/link";

// import { doLogout } from "@/lib/actions";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlignJustify, LogOut, MenuIcon } from "lucide-react";

import { Button } from "./ui/button";
import { usePathname } from "next/navigation";
import Image from "next/image";

const Navbar = () => {
    const pathname = usePathname();
    return (
        <div className="z-50 fixed flex justify-between items-center duration-200 delay-150 ease-in-out w-screen h-20 px-4 border-b-[0.1px] border-slate-600 border-opacity-20 dark:bg-opacity-50 bg-opacity-75 bg-white backdrop-blur-sm dark:bg-zinc-900">
            <div className="flex flex-row items-center gap-4 font-medium dark:text-slate-300 text-slate-900 justify-normal">
                <Link
                    href={"/"}
                    className="mr-4 text-3xl font-normal dark:font-thin"
                >
                    <Image
                        src={"/LogoCOSC.png"}
                        alt="COSC"
                        width={50}
                        height={50}
                    />
                </Link>
            </div>

            <div className="flex flex-row items-center gap-4 font-medium dark:text-slate-300 text-slate-900 justify-normal ">
                <div className="items-center hidden gap-4 md:flex ">
                    <Link
                        className={`duration-300 hover:text-blue-500 ${
                            pathname == "/" ? "text-blue-500" : ""
                        } `}
                        href={"/"}
                    >
                        Home
                    </Link>
                    <Link
                        className={`duration-300 hover:text-blue-500 ${
                            pathname.includes("/howto") ? "text-blue-500" : ""
                        } `}
                        href={"/howto"}
                    >
                        How to
                    </Link>
                    <Link
                        className={`duration-300 hover:text-blue-500 ${
                            pathname.includes("/generate") ? "text-blue-500" : ""
                        } `}
                        href={"/generate"}
                    >
                        Generate
                    </Link>
                    <Link
                        className={`duration-300 hover:text-blue-500 ${
                            pathname.includes("/distribute") ? "text-blue-500" : ""
                        } `}
                        href={"/distribute"}
                    >
                        Distribute
                    </Link>
                </div>

                <ModeToggle />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild className="md:hidden">
                        <Button className="h-10" variant="outline" size="icon">
                            <MenuIcon />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-44"
                        align="end"
                        forceMount
                    >
                        <DropdownMenuItem
                            asChild
                            className={`${pathname == "/" ? "bg-accent" : ""}`}
                        >
                            <Link className=" w-full" href={"/"}>
                                Home
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            asChild
                            className={`${
                                pathname.includes("/howto") ? "bg-accent" : ""
                            }`}
                        >
                            <Link className=" w-full" href={"/howto"}>
                                How to
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            asChild
                            className={`${
                                pathname.includes("/generate") ? "bg-accent" : ""
                            }`}
                        >
                            <Link className=" w-full" href={"/generate"}>
                                Generate
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            asChild
                            className={`${
                                pathname.includes("/distribute") ? "bg-accent" : ""
                            }`}
                        >
                            <Link className=" w-full" href={"/distribute"}>
                                Distribute
                            </Link>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
};

export default Navbar;
